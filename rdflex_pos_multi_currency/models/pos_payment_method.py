from odoo import fields, models

class PosPaymentMethod(models.Model):
    _inherit = "pos.payment.method"

    currency_id = fields.Many2one(related="cash_journal_id.currency_id")
