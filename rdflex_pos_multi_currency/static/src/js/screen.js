odoo.define('rdflex_pos_multi_currency.screen', function (require) {
var screens = require('point_of_sale.screens');
var core = require('web.core');

var QWeb = core.qweb;

screens.PaymentScreenWidget.include({
    click_paymentmethods: function (){
        this._super.apply(this, arguments);
        this.$('.currency-buttons').empty();
        var $currency_buttons = $(QWeb.render('PyamentCurrecy', {widget: this}));
        $currency_buttons.appendTo(this.$('.currency-buttons'));
    }

});

});
