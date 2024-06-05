"use strict";
exports.__esModule = true;
exports.getYelpData = void 0;
var axios_1 = require("axios");
var TOKEN = 'A3wqPndpKUAYbTPU2HntPTCVBngqJecTehgwtt8gV_KlRQQC-YE5IjXqqHlbmYq112iFJiUyy7DTVNimU7JWc2PYBDbFfdweFmqNMLsAJ8cssC-7-AvtJR370rY0YHYx';
var instance = axios_1["default"].create({
    baseURL: 'https://api.yelp.com/v3',
    timeout: 2000,
    headers: { 'Authorization': "Bearer " + TOKEN }
});
var getYelpData = function (id) {
    instance.get("/businesses/" + id)
        .then(function (response) {
        console.log(response);
    })["catch"](function (error) {
        console.log(error);
    })
        .then(function () {
        // always executed
    });
};
exports.getYelpData = getYelpData;
