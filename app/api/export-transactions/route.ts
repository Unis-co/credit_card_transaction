import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { card, data } = await req.json(); // still accept data if frontend sends it
    const workbook = new ExcelJS.Workbook();

    // ✅ if "data" isn't sent, use an empty array so forEach won't crash
    const safeData = Array.isArray(data) ? data : [];

    const sheet = workbook.addWorksheet(
      card === "all" ? "All_Transactions" : card || "Transactions"
    );
    addColumnsAndData(sheet, safeData);

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${card}.xlsx"`,
      },
    });
  } catch (err: any) {
    console.error("Export error:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Export failed" },
      { status: 500 }
    );
  }
}

function addColumnsAndData(sheet: ExcelJS.Worksheet, rows: any[]) {
  sheet.columns = [
    { header: "Posted_Date", key: "posted_date", width: 15 },
    { header: "Receipt_Number", key: "receipt_no", width: 20 },
    { header: "With_Receipt", key: "with_receipt", width: 12 },
    { header: "Card_No", key: "card_no", width: 18 },
    { header: "Description", key: "description", width: 30 },
    { header: "Category", key: "category", width: 15 },
    { header: "Amount", key: "amount", width: 12 },
    { header: "Company", key: "company", width: 15 },
    { header: "Location", key: "location", width: 20 },
    { header: "Department", key: "department", width: 20 },
    { header: "Expense_Category", key: "expense_category", width: 20 },
    { header: "Expense_Description", key: "expense_description", width: 40 },
    { header: "Traveler", key: "traveler", width: 20 },
    { header: "Status", key: "status", width: 15 },
    { header: "Upload_Receipt", key: "upload_receipt", width: 40 },
    { header: "Last_Update_By", key: "modifiedBy", width: 25 },
    { header: "Last_Update_Time", key: "lastModified", width: 25 },
  ];

  // ✅ won't crash if no rows
  (rows || []).forEach((t) => {
    sheet.addRow({
      posted_date: t.posted_date || "",
      receipt_no: t.receipt_no || "",
      with_receipt: t.with_receipt ? "Yes" : "No",
      card_no: t.card_no || "",
      description: t.description || "",
      category: t.category || "",
      amount: t.amount || "",
      company: t.company || "",
      location: t.location || "",
      department: t.department || "",
      expense_category: t.expense_category || "",
      expense_description: t.expense_description || "",
      traveler: t.traveler || "",
      status: t.status || "",
      upload_receipt: Array.isArray(t.upload_receipt)
        ? t.upload_receipt.join(", ")
        : t.upload_receipt || "",
      modifiedBy: t.modifiedBy || "",
      lastModified: t.lastModified || "",
    });
  });

  sheet.getRow(1).font = { bold: true };
}
