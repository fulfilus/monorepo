"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnrichmentSource = exports.QuotationStatus = exports.QuotationType = exports.PaymentType = exports.ContactStatus = exports.VendorCategory = void 0;
var VendorCategory;
(function (VendorCategory) {
    VendorCategory["RAW_MATERIALS"] = "RAW_MATERIALS";
    VendorCategory["ELECTRICAL_ELECTRONICS"] = "ELECTRICAL_ELECTRONICS";
    VendorCategory["MECHANICAL_TOOLS"] = "MECHANICAL_TOOLS";
    VendorCategory["FASTENERS_HARDWARE"] = "FASTENERS_HARDWARE";
    VendorCategory["CHEMICALS_LUBRICANTS"] = "CHEMICALS_LUBRICANTS";
    VendorCategory["SAFETY_PPE"] = "SAFETY_PPE";
    VendorCategory["HYDRAULICS_PNEUMATICS"] = "HYDRAULICS_PNEUMATICS";
    VendorCategory["PLASTICS_RUBBER"] = "PLASTICS_RUBBER";
    VendorCategory["PACKAGING_MATERIALS"] = "PACKAGING_MATERIALS";
    VendorCategory["CONSTRUCTION_MATERIALS"] = "CONSTRUCTION_MATERIALS";
    VendorCategory["BEARINGS_TRANSMISSION"] = "BEARINGS_TRANSMISSION";
    VendorCategory["INSTRUMENTATION"] = "INSTRUMENTATION";
    VendorCategory["GENERAL_INDUSTRIAL"] = "GENERAL_INDUSTRIAL";
})(VendorCategory || (exports.VendorCategory = VendorCategory = {}));
var ContactStatus;
(function (ContactStatus) {
    ContactStatus["CONTACTED"] = "CONTACTED";
    ContactStatus["NOT_CONTACTED"] = "NOT_CONTACTED";
})(ContactStatus || (exports.ContactStatus = ContactStatus = {}));
var PaymentType;
(function (PaymentType) {
    PaymentType["QR_CODE"] = "QR_CODE";
    PaymentType["PHONE_NUMBER"] = "PHONE_NUMBER";
    PaymentType["BANK_ACCOUNT"] = "BANK_ACCOUNT";
})(PaymentType || (exports.PaymentType = PaymentType = {}));
var QuotationType;
(function (QuotationType) {
    QuotationType["RFQ"] = "RFQ";
    QuotationType["PRICE_LIST"] = "PRICE_LIST";
    QuotationType["PO_QUOTE"] = "PO_QUOTE";
})(QuotationType || (exports.QuotationType = QuotationType = {}));
var QuotationStatus;
(function (QuotationStatus) {
    QuotationStatus["DRAFT"] = "DRAFT";
    QuotationStatus["SENT"] = "SENT";
    QuotationStatus["RECEIVED"] = "RECEIVED";
    QuotationStatus["ACCEPTED"] = "ACCEPTED";
    QuotationStatus["REJECTED"] = "REJECTED";
    QuotationStatus["EXPIRED"] = "EXPIRED";
})(QuotationStatus || (exports.QuotationStatus = QuotationStatus = {}));
var EnrichmentSource;
(function (EnrichmentSource) {
    EnrichmentSource["GOOGLE_MAPS"] = "GOOGLE_MAPS";
    EnrichmentSource["JUSTDIAL"] = "JUSTDIAL";
    EnrichmentSource["INDIAMART"] = "INDIAMART";
    EnrichmentSource["OCR"] = "OCR";
    EnrichmentSource["LLM"] = "LLM";
    EnrichmentSource["MANUAL"] = "MANUAL";
})(EnrichmentSource || (exports.EnrichmentSource = EnrichmentSource = {}));
