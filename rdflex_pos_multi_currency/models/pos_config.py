# -*- coding: utf-8 -*-

from odoo import api, fields, models, _
from odoo.tools import float_is_zero

from odoo.exceptions import ValidationError, UserError


class PosConfig(models.Model):
    _inherit = 'pos.config'

    @api.constrains('pricelist_id', 'available_pricelist_ids', 'journal_id', 'invoice_journal_id', 'journal_ids')
    def _check_currencies(self):
        if self.pricelist_id not in self.available_pricelist_ids:
            raise ValidationError(_("The default pricelist must be included in the available pricelists."))
        if any(self.available_pricelist_ids.mapped(lambda pricelist: pricelist.currency_id != self.company_id.currency_id)):
            raise ValidationError(_("All available pricelists must be in the same currency as the company."))
        if self.invoice_journal_id.currency_id and self.invoice_journal_id.currency_id != self.company_id.currency_id:
            raise ValidationError(_("The invoice journal must be in the same currency as the company currency."))
        # if self.journal_id.currency_id and self.journal_id.currency_id != self.company_id.currency_id:
        #     raise ValidationError(_("The sales journal must be in the same currency as the company currency."))


class PosOrder(models.Model):
    _inherit = 'pos.order'

    currency_id = fields.Many2one('res.currency', related=False, string="Currency")

    @api.model
    def _order_fields(self, ui_order):
        res = super(PosOrder, self)._order_fields(ui_order)
        res['currency_id'] = ui_order.get('currency').get('id')
        return res

    def _prepare_invoice_vals(self):
        res = super(PosOrder, self)._prepare_invoice_vals()
        res['currency_id'] = self.currency_id.id or self.pricelist_id.currency_id.id
        return res

    def _process_payment_lines(self, pos_order, order, pos_session, draft):
        """Create account.bank.statement.lines from the dictionary given to the parent function.

        If the payment_line is an updated version of an existing one, the existing payment_line will first be
        removed before making a new one.
        :param pos_order: dictionary representing the order.
        :type pos_order: dict.
        :param order: Order object the payment lines should belong to.
        :type order: pos.order
        :param pos_session: PoS session the order was created in.
        :type pos_session: pos.session
        :param draft: Indicate that the pos_order is not validated yet.
        :type draft: bool.
        """
        prec_acc = order.pricelist_id.currency_id.decimal_places

        order_bank_statement_lines = self.env['pos.payment'].search([('pos_order_id', '=', order.id)])
        order_bank_statement_lines.unlink()
        for payments in pos_order['statement_ids']:
            if not float_is_zero(payments[2]['amount'], precision_digits=prec_acc):
                order.add_payment(self._payment_fields(order, payments[2]))

        order.amount_paid = sum(order.payment_ids.mapped('amount'))

        if not draft and not float_is_zero(pos_order['amount_return'], prec_acc):
            if pos_order['statement_ids']:
                cash_payment_method_id = pos_order['statement_ids'][0][2].get('payment_method_id')
            else:
                cash_payment_method_id = pos_session.payment_method_ids.filtered('is_cash_count')[:1].id
            if not cash_payment_method_id:
                raise UserError(_("No cash statement found for this session. Unable to record returned cash."))
            return_payment_vals = {
                'name': _('return'),
                'pos_order_id': order.id,
                'amount': -pos_order['amount_return'],
                'payment_date': fields.Date.context_today(self),
                'payment_method_id': cash_payment_method_id,
            }
            order.add_payment(return_payment_vals)
