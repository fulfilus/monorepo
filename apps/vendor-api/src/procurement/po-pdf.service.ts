import { Injectable } from "@nestjs/common";
import * as PDFDocumentLib from "pdfkit";
const PDFDocument = (PDFDocumentLib as unknown as { default: typeof PDFDocumentLib }).default ?? PDFDocumentLib;
import type { Quotation, QuotationLineItem, Vendor } from "@prisma/client";

type QuotationWithVendor = Quotation & {
  lineItems: QuotationLineItem[];
  vendor: Vendor;
};

const FULFILUS = {
  name: "Fulfilus Pvt. Ltd.",
  address: "Plot 12, Industrial Area Phase II, Chandigarh — 160 002",
  gstin: "03AABCF1234A1Z5",
  email: "procurement@fulfilus.com",
  phone: "+91 98765 00000",
};

const TERMS = [
  "Delivery within agreed lead time from PO date.",
  "Goods must match specifications. Non-conforming goods will be returned at vendor's cost.",
  "Invoice must reference the PO number.",
  "Payment within 30 days of invoice receipt unless otherwise agreed.",
  "Fulfilus reserves the right to cancel for non-delivery without liability.",
];

@Injectable()
export class PoPdfService {
  generate(quotation: QuotationWithVendor): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      this.build(doc, quotation);
      doc.end();
    });
  }

  private build(doc: PDFKit.PDFDocument, q: QuotationWithVendor): void {
    const { vendor } = q;
    const blue = "#1d4ed8";
    const grey = "#6b7280";
    const black = "#111827";
    const lightGrey = "#f3f4f6";
    const today = new Date().toLocaleDateString("en-IN");

    // ── Header ──────────────────────────────────────────────────────────────
    doc.rect(0, 0, 595, 80).fill(blue);
    doc.fontSize(22).fillColor("#ffffff").text("PURCHASE ORDER", 50, 22);
    doc.fontSize(9).fillColor("#bfdbfe").text(FULFILUS.name, 50, 50);
    doc.fontSize(11).fillColor("#ffffff")
      .text(q.referenceNumber, 400, 22, { align: "right", width: 145 });
    doc.fontSize(9).fillColor("#bfdbfe")
      .text(`Date: ${today}`, 400, 40, { align: "right", width: 145 });

    doc.y = 100;

    // ── From / To ────────────────────────────────────────────────────────────
    const colW = 230;
    const fromX = 50;
    const toX = 315;

    doc.fontSize(8).fillColor(grey).text("FROM (BUYER)", fromX, 100);
    doc.fontSize(10).fillColor(black).text(FULFILUS.name, fromX, 112);
    doc.fontSize(8).fillColor(grey)
      .text(FULFILUS.address, fromX, 126, { width: colW })
      .text(`GSTIN: ${FULFILUS.gstin}`)
      .text(`Email: ${FULFILUS.email}`)
      .text(`Phone: ${FULFILUS.phone}`);

    doc.fontSize(8).fillColor(grey).text("TO (VENDOR)", toX, 100);
    doc.fontSize(10).fillColor(black).text(vendor.shopName, toX, 112);
    doc.fontSize(8).fillColor(grey)
      .text(vendor.location ?? "", toX, 126, { width: colW })
      .text(vendor.whatsappNumber ? `WhatsApp: ${vendor.whatsappNumber}` : "");

    const afterHeader = Math.max(doc.y, 185) + 14;

    // ── Meta strip ───────────────────────────────────────────────────────────
    doc.rect(50, afterHeader, 495, 22).fill("#eff6ff");
    doc.fontSize(9).fillColor(black);
    doc.text(`PO No: ${q.referenceNumber}`, 58, afterHeader + 6);
    doc.text(`Date: ${today}`, 210, afterHeader + 6);
    doc.text(`Title: ${q.title}`, 330, afterHeader + 6, { width: 210 });

    // ── Line items ───────────────────────────────────────────────────────────
    const tableTop = afterHeader + 34;

    doc.rect(50, tableTop, 495, 18).fill(blue);
    doc.fontSize(9).fillColor("#ffffff");
    doc.text("#", 55, tableTop + 4, { width: 20 });
    doc.text("Item", 75, tableTop + 4, { width: 170 });
    doc.text("Qty", 245, tableTop + 4, { width: 50, align: "right" });
    doc.text("Unit", 295, tableTop + 4, { width: 50 });
    doc.text("Unit Price", 345, tableTop + 4, { width: 80, align: "right" });
    doc.text("Total", 425, tableTop + 4, { width: 80, align: "right" });
    doc.text("GST", 505, tableTop + 4, { width: 40, align: "right" });

    let rowY = tableTop + 20;
    let subtotal = 0;

    q.lineItems.forEach((item, idx) => {
      if (idx % 2 === 0) doc.rect(50, rowY - 2, 495, 18).fill(lightGrey);
      const total = item.totalPrice ?? (item.quantity != null && item.unitPrice != null
        ? item.quantity * item.unitPrice : null);
      if (total != null) subtotal += total;

      doc.fontSize(8).fillColor(black);
      doc.text(String(idx + 1), 55, rowY, { width: 20 });
      doc.text(item.itemName, 75, rowY, { width: 170 });
      doc.text(item.quantity != null ? String(item.quantity) : "—", 245, rowY, { width: 50, align: "right" });
      doc.text(item.unit ?? "", 295, rowY, { width: 50 });
      doc.text(item.unitPrice != null ? `₹${item.unitPrice.toFixed(2)}` : "—", 345, rowY, { width: 80, align: "right" });
      doc.text(total != null ? `₹${total.toFixed(2)}` : "—", 425, rowY, { width: 80, align: "right" });
      doc.text("18%", 505, rowY, { width: 40, align: "right" });
      rowY += 18;
    });

    // ── Totals ───────────────────────────────────────────────────────────────
    const gst = subtotal * 0.18;
    const grandTotal = subtotal + gst;

    rowY += 6;
    doc.moveTo(50, rowY).lineTo(545, rowY).strokeColor("#d1d5db").stroke();
    rowY += 8;

    doc.fontSize(9).fillColor(black);
    doc.text("Subtotal", 345, rowY, { width: 155, align: "right" });
    doc.text(`₹${subtotal.toFixed(2)}`, 500, rowY, { width: 45, align: "right" });
    rowY += 14;
    doc.text("GST (18%)", 345, rowY, { width: 155, align: "right" });
    doc.text(`₹${gst.toFixed(2)}`, 500, rowY, { width: 45, align: "right" });
    rowY += 6;
    doc.moveTo(345, rowY).lineTo(545, rowY).strokeColor("#d1d5db").stroke();
    rowY += 6;
    doc.fontSize(11).fillColor(blue);
    doc.text("GRAND TOTAL", 345, rowY, { width: 155, align: "right" });
    doc.text(`₹${grandTotal.toFixed(2)}`, 500, rowY, { width: 45, align: "right" });

    // ── Terms ────────────────────────────────────────────────────────────────
    rowY += 30;
    doc.fontSize(9).fillColor(blue).text("Terms & Conditions", 50, rowY);
    rowY += 14;
    TERMS.forEach((term, i) => {
      doc.fontSize(8).fillColor(grey).text(`${i + 1}. ${term}`, 50, rowY, { width: 495 });
      rowY += 12;
    });

    // ── Signatures ───────────────────────────────────────────────────────────
    rowY += 20;
    const sigY = Math.min(rowY, 720);
    doc.moveTo(50, sigY + 30).lineTo(200, sigY + 30).strokeColor("#9ca3af").stroke();
    doc.moveTo(345, sigY + 30).lineTo(545, sigY + 30).strokeColor("#9ca3af").stroke();
    doc.fontSize(8).fillColor(grey)
      .text("Authorised Signatory — Fulfilus", 50, sigY + 34, { width: 150 })
      .text("Vendor Acceptance Signature", 345, sigY + 34, { width: 200 });

    // ── Footer ───────────────────────────────────────────────────────────────
    doc.fontSize(7).fillColor(grey)
      .text("This is a computer-generated Purchase Order.", 50, 820, { align: "center", width: 495 });
  }
}
