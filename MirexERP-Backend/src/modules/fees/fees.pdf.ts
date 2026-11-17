import { Response } from "express";
import { generateAndSendPdf } from "../../utils/pdf";

type Printable = Record<string, any>;

const currency = (value: unknown) =>
  `INR ${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const schoolAddress = (school: Printable) => {
  const address = school.address || {};
  return [address.street, address.area, address.city, address.state, address.postalCode]
    .filter(Boolean).join(", ");
};

const heading = (doc: PDFKit.PDFDocument, school: Printable, title: string) => {
  doc.font("Helvetica-Bold").fontSize(19).fillColor("#312e81").text(school.name || "School", { align: "center" });
  doc.moveDown(0.2).font("Helvetica").fontSize(9).fillColor("#475569")
    .text(schoolAddress(school), { align: "center" });
  doc.text([school.contact?.phone || school.phone, school.contact?.email || school.email].filter(Boolean).join("  |  "), { align: "center" });
  doc.moveDown(1).strokeColor("#c7d2fe").lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.7).font("Helvetica-Bold").fontSize(15).fillColor("#111827").text(title, { align: "center" });
  doc.moveDown(0.8);
};

export const sendFeeReceiptPdf = async (
  res: Response,
  school: Printable,
  payment: Printable
) => {
  const student = payment.studentId && typeof payment.studentId === "object" ? payment.studentId : {};
  const invoice = payment.invoiceId && typeof payment.invoiceId === "object" ? payment.invoiceId : {};
  const name = [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");
  const date = payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString("en-IN") : "—";
  return generateAndSendPdf(res, (doc) => {
    heading(doc, school, "FEE PAYMENT RECEIPT");
    const left = (label: string, value: unknown) => {
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#64748b").text(label.toUpperCase(), 55, doc.y, { continued: true, width: 145 });
      doc.font("Helvetica").fontSize(10).fillColor("#111827").text(String(value ?? "—"));
      doc.moveDown(0.65);
    };
    left("Receipt number", payment.receiptNumber);
    left("Payment date", date);
    left("Student", name || student.admissionNumber || "—");
    left("Admission number", student.admissionNumber);
    left("Invoice number", invoice.invoiceNumber);
    left("Payment method", payment.paymentMethod);
    left("Transaction reference", payment.transactionReference);
    doc.moveDown(0.5).roundedRect(55, doc.y, 485, 58, 8).fill("#eef2ff");
    doc.fillColor("#4338ca").font("Helvetica-Bold").fontSize(10).text("AMOUNT RECEIVED", 72, doc.y + 13);
    doc.fillColor("#1e1b4b").fontSize(19).text(currency(payment.amount), 72, doc.y + 29);
    doc.moveDown(5);
    doc.font("Helvetica").fontSize(9).fillColor("#64748b").text("This is a computer-generated receipt.", { align: "center" });
    doc.moveDown(2).font("Helvetica-Bold").fillColor("#111827").text("Authorized Signatory", { align: "right" });
  }, `fee-receipt-${payment.receiptNumber || payment._id}.pdf`, { title: "Fee Payment Receipt", subject: "MirexERP Fee Receipt" });
};

export const sendFeeInvoicePdf = async (
  res: Response,
  school: Printable,
  invoice: Printable
) => {
  const student = invoice.studentId && typeof invoice.studentId === "object" ? invoice.studentId : {};
  const name = [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");
  return generateAndSendPdf(res, (doc) => {
    heading(doc, school, "FEE INVOICE");
    doc.font("Helvetica").fontSize(10).fillColor("#111827");
    doc.text(`Invoice: ${invoice.invoiceNumber || "—"}       Due date: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-IN") : "—"}`);
    doc.moveDown(0.4).text(`Student: ${name || "—"}       Admission No: ${student.admissionNumber || "—"}`);
    doc.moveDown(1);
    const x=[55,330,420,500];
    doc.rect(55,doc.y,485,24).fill("#eef2ff");
    const y=doc.y+7;
    doc.fillColor("#312e81").font("Helvetica-Bold").fontSize(9);
    doc.text("Fee head / description",x[0]+8,y,{width:260});
    doc.text("Amount",x[1],y,{width:80,align:"right"});
    doc.text("Fine",x[2],y,{width:70,align:"right"});
    doc.text("Net",x[3],y,{width:35,align:"right"});
    doc.y+=31;
    doc.font("Helvetica").fontSize(9).fillColor("#1f2937");
    for(const item of (Array.isArray(invoice.items)?invoice.items:[])){
      if(doc.y>700)doc.addPage();
      const rowY=doc.y;
      doc.text(String(item.name||"Fee item"),x[0]+8,rowY,{width:260});
      doc.text(currency(item.amount),x[1],rowY,{width:80,align:"right"});
      doc.text(currency(item.fineAmount),x[2],rowY,{width:70,align:"right"});
      doc.text(currency(item.netAmount),x[3],rowY,{width:35,align:"right"});
      doc.moveDown(1.2).strokeColor("#e5e7eb").moveTo(55,doc.y).lineTo(540,doc.y).stroke();
      doc.moveDown(0.5);
    }
    doc.moveDown(1);
    const totals=[
      ["Subtotal",invoice.subtotal],["Discount",invoice.discountAmount],["Fine",invoice.fineAmount],
      ["Invoice total",invoice.totalAmount],["Paid",invoice.paidAmount],["Balance due",invoice.balanceAmount],
    ];
    for(const [label,value] of totals){
      doc.font(label==="Balance due"?"Helvetica-Bold":"Helvetica").fontSize(10).fillColor("#111827")
        .text(label,330,doc.y,{continued:true,width:100})
        .text(currency(value),{align:"right"});
      doc.moveDown(0.35);
    }
    if(invoice.remarks)doc.moveDown().fontSize(9).fillColor("#475569").text(`Remarks: ${invoice.remarks}`);
    doc.moveDown(2).fontSize(9).fillColor("#64748b").text("Please retain this invoice for your records.",{align:"center"});
  }, `fee-invoice-${invoice.invoiceNumber || invoice._id}.pdf`, { title: "Fee Invoice", subject: "MirexERP Fee Invoice" });
};
