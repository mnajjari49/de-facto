odoo.define('rdflex_pos_multi_currency.models', function (require) {
var core = require('web.core');

var models = require('point_of_sale.models');
var PosBaseWidget = require('point_of_sale.BaseWidget');
var _t = core._t;

models.load_fields("pos.payment.method", "currency_id");
models.load_models({
    model: 'res.currency',
    fields: ['name', 'symbol', 'position', 'rounding', 'rate'],
    loaded: function (self, currencies) {
        self.multi_currencies = currencies;
    }
});

var superOrder = models.Order.prototype;
models.Order = models.Order.extend({
    initialize: function () {
        superOrder.initialize.apply(this, arguments);
        this.currency = this.pos.currency;
    },
    init_from_JSON: function (json) {
        superOrder.init_from_JSON.apply(this, arguments);
        this.currency = json.currency;
    },
    export_as_JSON: function () {
        var values = superOrder.export_as_JSON.apply(this, arguments);
        values.currency = this.currency;
        return values;

    },
    set_currency: function (currency) {
        if (this.currency.id === currency.id) {
            return;
        }
        var formCurrency = this.currency || this.pos.currency;
        var toCurrency = currency;
        this.orderlines.each(function (line) {
            line.set_currency_price(formCurrency, toCurrency);
        });
        this.currency = currency;
    },
    get_currency: function () {
        return this.currency;
    },
    add_paymentline: function (paymentMethod) {
        var paymentlines = this.get_paymentlines();
        var isMultiCurrency = false;
        _.each(paymentlines, function (line) {
            if (line.payment_method.currency_id[0] !== paymentMethod.currency_id[0]) {
                isMultiCurrency = true;
            }
        });
        if (isMultiCurrency) {
            this.pos.gui.show_popup('alert', {
                title: _t("Payment Error"),
                body: _t("Payment of order should be in same currency. Payment could not be done with two different currency"),
            });
        } else {
            var journalCurrencyId = paymentMethod.currency_id[0];
            if (this.currency.id !== journalCurrencyId) {
                var currency = _.findWhere(this.pos.multi_currencies, {
                    id: journalCurrencyId
                });
                if (currency) {
                    this.set_currency(currency);
                }
            }
            superOrder.add_paymentline.apply(this, arguments);
        }
    },
});

models.Orderline = models.Orderline.extend({
    set_currency_price: function (formCurrency, toCurrency) {
        var conversionRate = toCurrency.rate / formCurrency.rate;
        this.price = this.price * conversionRate;
        
        var element = document.querySelector(".exchange-rate");

        if(!element){
            var ul = document.querySelector('.paymentmethod:nth-child(2)');
            var listItem = document.createElement('li');
            ul.appendChild(listItem);
            listItem.innerHTML = `<span class="exchange-rate" style="background-color: #e2e2e2;
                                    color: #55a27c;
                                    padding: 9px;
                                    font-weight: bold;">Exchange Rate: ${conversionRate.toPrecision(2)}</span>`;
        }

        

    },
});


PosBaseWidget.include({
    format_currency: function (amount,precision) {
        var currency = (this.pos && this.pos.currency) ? this.pos.currency : {symbol:'$', position: 'after', rounding: 0.01, decimals: 2};
        amount = this.format_currency_no_symbol(amount, precision);
        currency = this.pos.get_order().currency || currency;
        if (currency.position === 'after') {
            return amount + ' ' + (currency.symbol || '');
        } else {
            return (currency.symbol || '') + ' ' + amount;
        }
    },
});


});
