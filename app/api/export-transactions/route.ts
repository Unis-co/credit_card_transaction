// app/api/export-transactions/route.ts
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { card, data } = await req.json();

    const workbook = new ExcelJS.Workbook();

    // If exporting "all", create one sheet per card
    if (card === "all") {
      // Group by card name
      const grouped = data.reduce((acc: Record<string, any[]>, row: any) => {
        const key = row.name || "Unknown";
        acc[key] = acc[key] || [];
        acc[key].push(row);
        return acc;
      }, {});

      Object.entries(grouped).forEach(([cardName, rows]) => {
        const sheet = workbook.addWorksheet(cardName.slice(0, 31)); // Excel sheet name limit = 31 chars
        addColumnsAndData(sheet, rows as any[]);
      });
    } else {
      const sheet = workbook.addWorksheet(card || "Transactions");
      addColumnsAndData(sheet, data);
    }

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

// 🧩 Helper function to add full column set
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

  rows.forEach((t) => {
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
      upload_receipt:
        Array.isArray(t.upload_receipt) ? t.upload_receipt.join(", ") : t.upload_receipt || "",
      modifiedBy: t.modifiedBy || "",
      lastModified: t.lastModified || "",
      table_name: t.table_name || "",
      upload_receipt_0: Array.isArray(t.upload_receipt) ? t.upload_receipt[0] || "" : "",
      upload_receipt_1: Array.isArray(t.upload_receipt) ? t.upload_receipt[1] || "" : "",
    });
  });

  sheet.getRow(1).font = { bold: true }; // make headers bold
}
