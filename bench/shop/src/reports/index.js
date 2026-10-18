'use strict';

const { toCsv } = require('./csv');
const sales = require('./sales');

// Binds the shop's time zone so callers do not have to pass it each time.
function createReports({ config }) {
  const timeZone = config.timeZone;
  return {
    toCsv,
    salesSummary: (orders) => sales.salesSummary(orders),
    dailySales: (orders, date) => sales.dailySales(orders, date, { timeZone }),
    ordersCsv: (orders) => sales.ordersCsv(orders, { timeZone }),
  };
}

module.exports = { createReports, toCsv };
