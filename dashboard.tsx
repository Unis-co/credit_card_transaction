"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Loader2, CreditCard, Edit, Filter, Search, Clock, File, X, Save, Send, Eye } from "lucide-react"
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";


interface UploadedFile {
  name: string
  size: number
  type: string
  file: File
  url: string
}

interface SplitLine {
  amount: number
  company: string
  location: string
  department: string
  expense_category: string
  traveler: string
  expense_description: string
}

interface Transaction {
  id: string
  posted_date: string
  receipt_no: string
  with_receipt: boolean
  card_no: string
  description: string
  category: string
  amount: number
  company: string
  location: string
  department: string
  expense_category: string
  expense_description: string
  traveler: string
  status: "pending" | "submitted" | "underviewing"
  uploadedFiles?: UploadedFile[]
  upload_receipt?: string[]
  table_name: string
  name: string
  card_holders: string
  ap_approved: 0 | 1
  split_lines?: SplitLine[]
  split_amount?: number
  hasMultipleLines?: boolean | null
  class_bnp?: string
}

function dedupeByReceiptAndCard<T extends { receipt_no: string; name: string }>(items: T[]): T[] {
  const normalize = (val: string | undefined | null) => (val ?? "").trim().toLowerCase()
  const seen = new Map<string, T>()
  for (const item of items) {
    const key = `${normalize(item.receipt_no)}-${normalize(item.name)}`
    seen.set(key, item)
  }
  return Array.from(seen.values())
}

const normalizeCompany = (company: string): string => {
  const map: Record<string, string> = {
    "UNIS TRANSPORTATION, LLC": "UT",
    "UNIS_TRANSPORTATION":"UT",
    "UNIS, LLC": "UF",
    "UNIS,_LLC_/_UNIS_FULFILLMENT": "UF",
    "COFREIGHT,_INC" : "COFREIGHT",
    "LOGISTICS SERVICE ORG": "LSO",
    "LSO Parcel, Inc.":"LSO",
    "ZEN DISTRIBUTION": "ZEN",
    "CUBEWORK INC": "CUBEWORK",
  }
  return map[company.trim().toUpperCase()] || company
}

const sortUnique = (arr: (string | undefined | null)[]) =>
  Array.from(new Set(arr.filter(Boolean).map((v) => String(v)))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  )

const handleLogout = () => {
  localStorage.removeItem("user_email")
  window.location.href = "/login"
}

const uploadToItemDotCom = async (file: File, fileName: string): Promise<string | null> => {
  try {
    const tokenRes = await fetch("https://id.item.com/oauth2/token", {
      method: "POST",
      headers: {
        Authorization:
          "Basic NjY1ZDgwOGMtNDA0MS00NDhmLTlkZTgtZmMxYjliNmMzYjk1Ojc2MDMxMmY2LWI3NTEtNGJmYi05MDg4LTczYWY1MzA3ZTE0NQ==",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    })

    const tokenJson = await tokenRes.json()
    const accessToken = tokenJson.access_token

    if (!accessToken) throw new Error("Failed to get access token")

    const formData = new FormData()
    formData.append("filename", fileName)
    formData.append("operator", "alzhou")
    formData.append("file", file)

    const uploadRes = await fetch("https://api-base.item.com/api/file-app/v1/file/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Tenant-Id": "CeTPb1854416900893839360",
      },
      body: formData,
    })

    const result = await uploadRes.json()
    if (result?.success && result?.data?.non_expire_view_url) {
      return result.data.non_expire_view_url
    }

    console.error("Upload failed:", result)
    return null
  } catch (e) {
    console.error("Upload error:", e)
    return null
  }
}

export default function Dashboard() {
  const [userEmail, setUserEmail] = useState<string>("")
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [originalTransactions, setOriginalTransactions] = useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [isSaving, setIsSaving] = useState<string>("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [pageInput, setPageInput] = useState<string>("")
  const savedPageRef = useRef(1)
  const pageGuardRef = useRef(false)

  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [receiptFilter, setReceiptFilter] = useState("")
  const [nameFilter, setNameFilter] = useState("all")
  const [cardHolderFilter, setCardHolderFilter] = useState("all")

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const [locations, setLocations] = useState<string[]>([])
  const [isLocLoading, setIsLocLoading] = useState(false)
  const [locError, setLocError] = useState<string>("")

  const [expenseCategories, setExpenseCategories] = useState<string[]>([])
  const [isCatLoading, setIsCatLoading] = useState(false)
  const [catError, setCatError] = useState<string>("")

  const knownDepartments = [
    "Accounting",
    "Administration/Executive",
    "Corp",
    "Corp01",
    "Information Technology",
    "Operation",
    "Warehouse",
    "Sales",
    "Customer Service",
    "Transportation",
    "FPA",
    "Human Resources",
    "Maintenance",
    "Account Management",
    "Marketing",
    "Safety",
    "Drayage Division",
  ]

  const classOptions = [
    "Corp",
    "Drayage Division",
    "Brokerage Division",
    "Trucking Division",
    "External-POD",
    "Internal",
    "Corp2",
    "Shark Ninja",
    "LSO",
    "General Business",
  ]

  const apUsers = [
    "xueyan.zhang@unisco.com",
    "joice.casila@unisco.com",
    "laiza.granzo@unisco.com",
    "alvin.li@unisco.com",
    "xueyan@unisco.com",
    "cherry.villamor@unisco.com",
    "victor.magallen@unisco.com",
    "jobea.diverte@unisco.com",
    "devine.alarin@unisco.com",
    "anlyn.manto@unisco.com",
    "joanyl.tampus@unisco.com",
    "marivic.cempron@unisco.com",
    "samwise.luo@unisco.com",
    "jason.lu@unisco.com",
    "yuxi.liu@unisco.com",
    "kevin.chen@unisco.com",
    "cathymae.anonuevo@unisco.com",
    "jason.chang@unisco.com",
    "joyce.pamalandong@unisco.com"
  ]

  const isAPUser = apUsers.includes(userEmail.toLowerCase())

  const allDepartments = useMemo(() => {
    return [...knownDepartments].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
  }, [])

  const handleExportExcel = async () => {
    try {
      const fileName =
        nameFilter === "all" ? "all_cards.xlsx" : `${nameFilter}.xlsx`;
  
      // 🧩 Create workbook & worksheet
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(
        nameFilter === "all" ? "All_Transactions" : nameFilter || "Transactions"
      );
  
      // 🧩 Define columns (same as your backend)
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
  
      // 🧩 Add your filtered transactions as rows
      filteredTransactions.forEach((t) => {
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
  
      // 🧩 Generate & download Excel
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(blob, fileName);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed. Please try again.");
    }
  };


  const cardNames = useMemo(() => sortUnique(originalTransactions.map((t) => t.name)), [originalTransactions])
  const { toast } = useToast()

  const loadUserData = async () => {
    const email = localStorage.getItem("user_email")
    if (!email) {
      setError("No user email found. Please log in again.")
      setIsLoading(false)
      return
    }
    setUserEmail(email)

    try {
      const response = await fetch(`/api/get-user-transactions?email=${encodeURIComponent(email)}`)
      if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`)
      const rawData = await response.json()

      if (rawData && rawData.length > 0) {
        const transactionsWithFiles = rawData.map((t: Transaction) => {
          try {
            if (t.card_holders) t.card_holders = JSON.parse(t.card_holders as any)
          } catch {
            t.card_holders = String(t.card_holders || "")
          }

          if (t.upload_receipt) {
            try {
              const urls = Array.isArray(t.upload_receipt) ? t.upload_receipt : JSON.parse(t.upload_receipt as any)
              t.uploadedFiles = urls.map((url: string, idx: number) => ({
                name: url.split("/").pop() || `Receipt ${idx + 1}`,
                size: 0,
                type: "application/octet-stream",
                file: {} as File,
                url,
              }))
              t.with_receipt = t.uploadedFiles.length > 0
            } catch {
              t.uploadedFiles = [
                {
                  name: (t.upload_receipt as string).split("/").pop() || "Receipt",
                  size: 0,
                  type: "application/octet-stream",
                  file: {} as File,
                  url: t.upload_receipt as string,
                },
              ]
              t.with_receipt = true
            }
          }
          return t
        })

        const deduped = dedupeByReceiptAndCard(transactionsWithFiles)
        setOriginalTransactions(deduped)
        setTransactions(deduped)
        setFilteredTransactions(deduped)
      }
    } catch (err) {
      console.error("Error fetching transactions:", err)
      setError("Failed to load transactions from API.")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchLocations = async () => {
    try {
      setIsLocLoading(true)
      setLocError("")
      const res = await fetch("/api/locations")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const list: string[] = await res.json()
      setLocations(list)
    } catch (e: any) {
      console.error("Failed to fetch locations:", e)
      setLocError(e?.message || "Failed to load locations")
      setLocations([])
    } finally {
      setIsLocLoading(false)
    }
  }

  const fetchExpenseCategories = async () => {
    try {
      setIsCatLoading(true)
      setCatError("")
      const res = await fetch("/api/expense-categories")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setExpenseCategories(data.categories || [])
    } catch (e: any) {
      console.error("Failed to fetch expense categories:", e)
      setCatError(e?.message || "Failed to load expense categories")
      setExpenseCategories([])
    } finally {
      setIsCatLoading(false)
    }
  }

  useEffect(() => {
    if (pageGuardRef.current) return
    setCurrentPage(1)
    setPageInput("1")
  }, [startDate, endDate, statusFilter, receiptFilter, nameFilter, cardHolderFilter])

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredTransactions.length / itemsPerPage))
    if (currentPage > maxPage) {
      setCurrentPage(maxPage)
      setPageInput(String(maxPage))
    }
  }, [filteredTransactions.length, itemsPerPage, currentPage])

  useEffect(() => {
    const email = localStorage.getItem("user_email")
    if (!email) {
      window.location.href = "/login"
      return
    }
    setUserEmail(email)
    loadUserData()
  }, [])

  useEffect(() => {
    if (isEditModalOpen) {
      fetchLocations()
      fetchExpenseCategories()
    }
  }, [isEditModalOpen])

  useEffect(() => {
    if (statusFilter === "all") {
      setOriginalTransactions(dedupeByReceiptAndCard([...transactions]))
    }
  }, [statusFilter, transactions])

  useEffect(() => {
    let filtered = dedupeByReceiptAndCard([...originalTransactions])

    if (startDate && endDate) {
      filtered = filtered.filter((t) => {
        const posted = new Date(t.posted_date)
        return posted >= new Date(startDate) && posted <= new Date(endDate)
      })
    }

    if (statusFilter && statusFilter.toLowerCase() !== "all") {
      filtered = filtered.filter((t) => (t.status || "pending").toLowerCase() === statusFilter.toLowerCase())
    }

    if (receiptFilter) {
      filtered = filtered.filter((t) => (t.receipt_no || "").toLowerCase().includes(receiptFilter.toLowerCase()))
    }

    if (nameFilter !== "all") {
      filtered = filtered.filter((t) => (t.name || "").trim().toLowerCase() === nameFilter.trim().toLowerCase())
    }

    if (cardHolderFilter !== "all") {
      filtered = filtered.filter(
        (t) =>
          String(t.card_holders || "")
            .trim()
            .toLowerCase() === cardHolderFilter.trim().toLowerCase(),
      )
    }

    filtered = filtered.sort((a, b) => new Date(b.posted_date).getTime() - new Date(a.posted_date).getTime())
    setFilteredTransactions(filtered)
  }, [originalTransactions, startDate, endDate, statusFilter, receiptFilter, nameFilter, cardHolderFilter])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: "bg-yellow-100 text-yellow-800", icon: Clock },
      submitted: { color: "bg-green-100 text-green-800", icon: Send },
      underviewing: { color: "bg-indigo-100 text-indigo-800", icon: Eye },
    }

    const normalizedStatus = (status || "pending").toLowerCase()
    const config = statusConfig[normalizedStatus as keyof typeof statusConfig] || statusConfig.pending
    const Icon = config.icon

    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const handleRemoveFileInModal = (index: number) => {
    if (!editingTransaction?.uploadedFiles) return

    const files = [...editingTransaction.uploadedFiles]
    const [removed] = files.splice(index, 1)
    URL.revokeObjectURL(removed.url)

    const newStatus = files.length > 0 ? "submitted" : "pending"

    const updatedTransaction = {
      ...editingTransaction,
      uploadedFiles: files,
      upload_receipt: files.map((f) => f.url),
      with_receipt: files.length > 0,
      status: newStatus,
    }

    setEditingTransaction(updatedTransaction)
    setTransactions((prev) => prev.map((t) => (t.id === updatedTransaction.id ? updatedTransaction : t)))
    setFilteredTransactions((prev) => prev.map((t) => (t.id === updatedTransaction.id ? updatedTransaction : t)))

    toast({
      title: "Receipt removed",
      description: `${removed.name} has been deleted.`,
    })
  }

  const handleEditTransaction = (transaction: Transaction) => {
    const uploadedFiles: UploadedFile[] = []

    if (transaction.upload_receipt) {
      try {
        const maybeArray = Array.isArray(transaction.upload_receipt)
          ? transaction.upload_receipt
          : JSON.parse(transaction.upload_receipt as any)

        if (Array.isArray(maybeArray)) {
          maybeArray.forEach((url: string, idx: number) => {
            uploadedFiles.push({
              name: url.split("/").pop() || `Receipt ${idx + 1}`,
              size: 0,
              type: "application/octet-stream",
              file: new Blob([], { type: "application/octet-stream" }) as File,
              url,
            })
          })
        } else if (typeof maybeArray === "string") {
          uploadedFiles.push({
            name: maybeArray.split("/").pop() || "Receipt",
            size: 0,
            type: "application/octet-stream",
            file: {} as File,
            url: maybeArray,
          })
        }
      } catch (e) {
        uploadedFiles.push({
          name: (transaction.upload_receipt as any).split("/").pop() || "Receipt",
          size: 0,
          type: "application/octet-stream",
          file: {} as File,
          url: transaction.upload_receipt as any,
        })
      }
    }

    const hasValidSplitLines =
      Array.isArray(transaction.split_lines) &&
      transaction.split_lines.some(
        (line) => line && (line.amount || line.company || line.location || line.department || line.expense_description),
      )
    const hasSingleLineData =
      !hasValidSplitLines &&
      !!(transaction.company || transaction.department || transaction.location || transaction.expense_description)
    const hasMultipleLines = hasValidSplitLines ? true : hasSingleLineData ? false : null

    setEditingTransaction({
      ...transaction,
      uploadedFiles: uploadedFiles,
      with_receipt: uploadedFiles.length > 0,
      split_lines: transaction.split_lines || [],
      hasMultipleLines,
    })
    setIsEditModalOpen(true)
  }

  const handleFileUploadInModal = (file: File | null) => {
    if (!file || !editingTransaction) return

    const fileUrl = URL.createObjectURL(file)
    const newFile: UploadedFile = {
      name: file.name,
      size: file.size,
      type: file.type,
      file: file,
      url: fileUrl,
    }

    const updatedFiles = [...(editingTransaction.uploadedFiles || []), newFile]
    setEditingTransaction({
      ...editingTransaction,
      uploadedFiles: updatedFiles,
      with_receipt: true,
      status: "pending",
    })

    toast({
      title: "File uploaded",
      description: `${file.name} was added to the receipt list.`,
    })
  }

  const handleSaveTransaction = async () => {
    if (!editingTransaction) return

    if (editingTransaction.hasMultipleLines === true) {
      const invalidLine = (editingTransaction.split_lines || []).find(
        (line) => !line.amount || !line.company || !line.location || !line.department || !line.expense_description,
      )

      if (invalidLine) {
        toast({
          title: "Required fields missing in line details",
          description: "Each line must have Amount, Company, Location, Department, and Expense Description filled in.",
          variant: "destructive",
        })
        return
      }
    } else {
      if (
        !editingTransaction.company ||
        !editingTransaction.location ||
        !editingTransaction.department ||
        !editingTransaction.expense_description
      ) {
        toast({
          title: "Required fields missing",
          description: "Please fill in Company, Location, Department, and Expense Description fields.",
          variant: "destructive",
        })
        return
      }
    }

    const shouldSubmit =
      (editingTransaction.uploadedFiles && editingTransaction.uploadedFiles.length > 0) ||
      editingTransaction.ap_approved === 1
    const optimisticTransaction = { ...editingTransaction, status: shouldSubmit ? "submitted" : "pending" }

    setEditingTransaction(optimisticTransaction)
    setTransactions((prev) => prev.map((t) => (t.id === optimisticTransaction.id ? optimisticTransaction : t)))
    setFilteredTransactions((prev) => prev.map((t) => (t.id === optimisticTransaction.id ? optimisticTransaction : t)))

    toast({
      title: shouldSubmit ? "Submitted (Pending Sync)" : "Saved locally",
      description: shouldSubmit
        ? "Your transaction was marked as submitted. Syncing with the server..."
        : "Changes saved. Waiting for receipts or AP approval.",
    })

    setIsSaving(editingTransaction.id)
    savedPageRef.current = currentPage

    try {
      let filesData: any[] = []
      if (editingTransaction.uploadedFiles && editingTransaction.uploadedFiles.length > 0) {
        filesData = []
        for (const file of editingTransaction.uploadedFiles) {
          if (file.url?.startsWith("http") && !file.file?.name) {
            filesData.push({ name: file.name, url: file.url })
          } else {
            const url = await uploadToItemDotCom(file.file, file.name)
            if (url) {
              filesData.push({ name: file.name, url })
            }
          }
        }
      }

      const transactionData = {
        transactionId: editingTransaction.id || "",
        email: userEmail || "",
        postedDate: editingTransaction.posted_date || "",
        receiptNumber: editingTransaction.receipt_no || "",
        with_receipt: editingTransaction.with_receipt ?? false,
        cardNumber: editingTransaction.card_no || "",
        description: editingTransaction.description || "",
        category: editingTransaction.category || "",
        amount: editingTransaction.amount ?? 0,
        company: editingTransaction.company || "",
        location: editingTransaction.location || "",
        department: editingTransaction.department || "",
        expense_category: editingTransaction.expense_category || "",
        expense_description: editingTransaction.expense_description || "",
        traveler: editingTransaction.traveler || "",
        status: editingTransaction.ap_approved === 1 ? "submitted" : editingTransaction.status,
        table_name: editingTransaction.table_name || "",
        name: editingTransaction.name || "",
        uploadedFiles: filesData,
        upload_receipt: filesData,
        timestamp: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        modifiedBy: userEmail || "",
        ap_approved: editingTransaction.ap_approved ?? 0,
        split_lines: editingTransaction.split_lines || [],
        split_amount: editingTransaction.split_amount ?? null,
        class_bnp: editingTransaction.class_bnp || "",
      }

      const response = await fetch("/api/update-transaction", {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(transactionData),
      })

      if (response.ok) {
        let result
        try {
          result = await response.json()
        } catch {
          result = await response.text()
        }

        const wasSuccessful = typeof result === "object" && result !== null && result.success === true
        const hasReceipts =
          (filesData && filesData.length > 0) ||
          (editingTransaction.uploadedFiles && editingTransaction.uploadedFiles.length > 0)
        const newStatus = editingTransaction.ap_approved === 1 ? "submitted" : hasReceipts ? "submitted" : "pending"

        const updatedTransaction = {
          ...editingTransaction,
          uploadedFiles:
            filesData.length > 0
              ? filesData.map((f) => ({
                  name: f.name,
                  size: 0,
                  type: "application/octet-stream",
                  file: {} as File,
                  url: f.url,
                }))
              : editingTransaction.uploadedFiles || [],
          upload_receipt: filesData.map((f) => f.url),
          with_receipt: filesData.length > 0 || (editingTransaction.uploadedFiles?.length ?? 0) > 0,
          status: newStatus as "submitted" | "pending" | "underviewing",
        }

        const updatedList = transactions.map((t) => (t.id === updatedTransaction.id ? updatedTransaction : t))
        const dedupedList = dedupeByReceiptAndCard(updatedList).sort(
          (a, b) => new Date(b.posted_date).getTime() - new Date(a.posted_date).getTime(),
        )

        setTransactions(dedupedList)
        setOriginalTransactions(dedupedList)

        if (statusFilter === "all") {
          setFilteredTransactions(dedupedList)
        } else {
          setFilteredTransactions(dedupedList.filter((t) => t.status.toLowerCase() === statusFilter.toLowerCase()))
        }

        setStatusFilter("all")

        setTimeout(() => {
          setCurrentPage(savedPageRef.current)
          setPageInput(String(savedPageRef.current))
        }, 0)

        setIsEditModalOpen(false)
        setEditingTransaction(null)

        toast({
          title: wasSuccessful ? "Transaction submitted successfully" : "Saved locally, but webhook failed",
          description: wasSuccessful
            ? "Your changes have been saved to n8n."
            : "Webhook did not return success, so status remains pending.",
          variant: wasSuccessful ? "default" : "destructive",
        })

        setReceiptFilter("")

        if (wasSuccessful) return
      } else {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      console.error("Error updating transaction:", error)

      const updatedTransaction = {
        ...editingTransaction,
        uploadedFiles: [],
        upload_receipt: [],
        with_receipt: false,
        status: "pending" as const,
      }

      const combinedList = transactions.map((t) => (t.id === updatedTransaction.id ? updatedTransaction : t))
      const dedupedList = dedupeByReceiptAndCard(combinedList)

      setTransactions(dedupedList)
      setOriginalTransactions(dedupedList)

      setTimeout(() => {
        setCurrentPage(savedPageRef.current)
        setPageInput(String(savedPageRef.current))
      }, 0)

      toast({
        title: "❌ Submission Failed — Receipt Not Saved",
        description: `We couldn't submit your transaction to the server. The uploaded receipt has been removed to avoid confusion. Status remains **pending**. Please try again later.`,
        variant: "destructive",
        duration: 8000,
      })
      setIsEditModalOpen(false)
      setEditingTransaction(null)
    } finally {
      setIsSaving("")
    }
  }

  const clearFilters = () => {
    setStartDate("")
    setEndDate("")
    setStatusFilter("all")
    setReceiptFilter("")
    setNameFilter("all")
    setCardHolderFilter("all")
  }

  const getStats = () => {
    const total = filteredTransactions.length
    const with_receipts = filteredTransactions.filter((t) => t.with_receipt).length
    const totalAmount = filteredTransactions.reduce((sum, t) => {
      const amount = Number(t.amount)
      return sum + (isNaN(amount) ? 0 : amount)
    }, 0)
    const pending = filteredTransactions.filter((t) => (t.status || "pending").toLowerCase() === "pending").length
    const submitted = filteredTransactions.filter((t) => (t.status || "pending").toLowerCase() === "submitted").length
    const underviewing = filteredTransactions.filter(
      (t) => (t.status || "pending").toLowerCase() === "underviewing",
    ).length
    return { total, with_receipts, totalAmount, pending, submitted, underviewing }
  }

  const stats = getStats()

  const paginatedTransactions = [...filteredTransactions]
    .sort((a, b) => new Date(b.posted_date).getTime() - new Date(a.posted_date).getTime())
    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-600">Loading your transactions...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-6 w-6" />
              Credit Card Transaction Dashboard
            </CardTitle>
            <CardDescription>
              Logged in as: <span className="font-semibold text-blue-600">{userEmail}</span>
              {error && <span className="ml-2 text-orange-600 text-sm">(Using demo data)</span>}
            </CardDescription>
            <div className="flex items-center gap-2 mt-2">
              <Button size="sm" variant="destructive" onClick={handleLogout}>
                Logout
              </Button>
              {isAPUser && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() =>
                    window.open("https://ailinker.item.com/form/d69462d2-f292-4b98-9ac4-fbd6ca6dee1f", "_blank")
                  }
                >
                  Submit Form to inform Card Holders
                </Button>
              )}
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Transactions</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <CreditCard className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Submitted</p>
                  <p className="text-2xl font-bold">{stats.submitted}</p>
                </div>
                <Send className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Underviewing</p>
                  <p className="text-2xl font-bold">{stats.underviewing}</p>
                </div>
                <Eye className="h-8 w-8 text-indigo-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="status-filter">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="underviewing">Underviewing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="name-filter">Card Name</Label>
                <Select value={nameFilter} onValueChange={setNameFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All cards" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All cards</SelectItem>
                    {cardNames.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="receipt-filter">Receipt Number</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="receipt-filter"
                    placeholder="Search receipt..."
                    value={receiptFilter}
                    onChange={(e) => setReceiptFilter(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="card-holder-filter">Card Holder</Label>
                <Select value={cardHolderFilter} onValueChange={setCardHolderFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All card holders" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All card holders</SelectItem>
                    {sortUnique(originalTransactions.map((t) => t.card_holders)).map((holder) => (
                      <SelectItem key={holder} value={holder}>
                        {holder}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters} className="w-full bg-transparent">
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle>Transactions ({filteredTransactions.length})</CardTitle>
            <Button onClick={handleExportExcel} variant="outline">
              Export to Excel
            </Button>
          </CardHeader>
          <CardContent>
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-8">
                <CreditCard className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-lg text-gray-600">
                  {transactions.length === 0
                    ? `No transactions assigned to: ${userEmail}`
                    : "No transactions match your current filters"}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Receipt #</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Receipt</TableHead>
                        <TableHead>Card</TableHead>
                        <TableHead>Card Name</TableHead>
                        <TableHead>Card Holder</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTransactions.map((transaction) => (
                        <TableRow key={`${transaction.receipt_no}-${transaction.name}-${transaction.id}`}>
                          <TableCell>{transaction.posted_date || "—"}</TableCell>
                          <TableCell>{transaction.receipt_no || "—"}</TableCell>
                          <TableCell>{getStatusBadge(transaction.status || "pending")}</TableCell>
                          <TableCell>
                            <Badge variant={transaction.with_receipt ? "default" : "secondary"}>
                              {transaction.with_receipt ? "Yes" : "No"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{transaction.card_no || "—"}</TableCell>
                          <TableCell className="font-medium">{transaction.name || "—"}</TableCell>
                          <TableCell>{transaction.card_holders || "—"}</TableCell>
                          <TableCell className="max-w-xs truncate">{transaction.description || "—"}</TableCell>
                          <TableCell className="font-semibold">{formatCurrency(transaction.amount || 0)}</TableCell>
                          <TableCell className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditTransaction(transaction)}
                              disabled={isSaving === transaction.id}
                              className={
                                transaction.status === "underviewing"
                                  ? "border-gray-300 text-gray-400 cursor-not-allowed"
                                  : ""
                              }
                            >
                              {isSaving === transaction.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Edit className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-wrap justify-center items-center gap-4 mt-4">
                  <Button
                    variant="outline"
                    disabled={currentPage === 1}
                    onClick={() => {
                      const newPage = currentPage - 1
                      setCurrentPage(newPage)
                      setPageInput(newPage.toString())
                    }}
                  >
                    Previous
                  </Button>

                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {Math.max(1, Math.ceil(filteredTransactions.length / itemsPerPage))}
                  </span>

                  <Input
                    type="text"
                    inputMode="numeric"
                    value={pageInput}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === "") {
                        setPageInput("")
                        return
                      }

                      if (/^\d+$/.test(val)) {
                        const num = Number.parseInt(val, 10)
                        setPageInput(val)

                        const maxPage = Math.ceil(filteredTransactions.length / itemsPerPage)
                        if (num >= 1 && num <= maxPage) {
                          setCurrentPage(num)
                        }
                      }
                    }}
                    className="w-20 text-center"
                    placeholder="Page #"
                  />

                  <Button
                    variant="outline"
                    disabled={currentPage >= Math.ceil(filteredTransactions.length / itemsPerPage)}
                    onClick={() => {
                      const newPage = currentPage + 1
                      setCurrentPage(newPage)
                      setPageInput(newPage.toString())
                    }}
                  >
                    Next
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="!w-[60vw] !max-w-[60vw] !max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Transaction Details</DialogTitle>
              <DialogDescription>
                View and edit transaction information. Read-only fields are shown in gray.
              </DialogDescription>
            </DialogHeader>

            {editingTransaction && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="view-date">Posted Date</Label>
                    <Input
                      id="view-date"
                      value={editingTransaction.posted_date || ""}
                      disabled
                      className="bg-gray-100 text-gray-600"
                    />
                  </div>

                  <div>
                    <Label htmlFor="view-receipt-number">Receipt Number</Label>
                    <Input
                      id="view-receipt-number"
                      value={editingTransaction.receipt_no || ""}
                      disabled
                      className="bg-gray-100 text-gray-600"
                    />
                  </div>

                  <div>
                    <Label htmlFor="view-card-number">Card Number</Label>
                    <Input
                      id="view-card-number"
                      value={editingTransaction.card_no || ""}
                      disabled
                      className="bg-gray-100 text-gray-600"
                    />
                  </div>

                  <div>
                    <Label htmlFor="view-description">Description</Label>
                    <Input
                      id="view-description"
                      value={editingTransaction.description || ""}
                      disabled
                      className="bg-gray-100 text-gray-600"
                    />
                  </div>

                  <div>
                    <Label htmlFor="view-category">Category</Label>
                    <Input
                      id="view-category"
                      value={editingTransaction.category || ""}
                      disabled
                      className="bg-gray-100 text-gray-600"
                    />
                  </div>

                  <div>
                    <Label htmlFor="view-amount">Total Amount</Label>
                    <Input
                      id="view-amount"
                      value={formatCurrency(editingTransaction.amount || 0)}
                      disabled
                      className="bg-gray-100 text-gray-600"
                    />
                  </div>

                  <div>
                    <Label htmlFor="view-with-receipt">With Receipt</Label>
                    <Input
                      id="view-with-receipt"
                      value={editingTransaction.with_receipt ? "Yes" : "No"}
                      disabled
                      className="bg-gray-100 text-gray-600"
                    />
                  </div>

                  <div>
                    <Label htmlFor="view-status">Status (Read-only)</Label>
                    <Input
                      id="view-status"
                      value={
                        (editingTransaction.status || "pending").charAt(0).toUpperCase() +
                        (editingTransaction.status || "pending").slice(1)
                      }
                      disabled
                      className="bg-gray-100 text-gray-600"
                    />
                  </div>

                  {editingTransaction?.hasMultipleLines === false && (
                    <>
                      <div>
                        <Label htmlFor="edit-company">Company *</Label>
                        <p className="text-sm text-muted-foreground mb-1">
                          Please provide the company that this cost is associated with.
                        </p>
                        <Select
                          disabled={editingTransaction?.status === "underviewing"}
                          value={normalizeCompany(editingTransaction.company || "")}
                          onValueChange={(value) => setEditingTransaction({ ...editingTransaction, company: value })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select company" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="UT">UT</SelectItem>
                            <SelectItem value="UF">UF</SelectItem>
                            <SelectItem value="LSO">LSO</SelectItem>
                            <SelectItem value="ZEN">ZEN</SelectItem>
                            <SelectItem value="CUBEWORK">CUBEWORK</SelectItem>
                            <SelectItem value="CORP">CORP</SelectItem>
                            <SelectItem value="COFREIGHT">COFREIGHT</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="edit-location">Location *</Label>
                        <p className="text-sm text-muted-foreground mb-1">
                          Please provide the location that this cost is associated with.
                        </p>
                        <Select
                          disabled={editingTransaction?.status === "underviewing"}
                          value={editingTransaction.location || ""}
                          onValueChange={(value) => setEditingTransaction({ ...editingTransaction, location: value })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder={isLocLoading ? "Loading locations..." : "Select location"} />
                          </SelectTrigger>
                          <SelectContent className="max-h-60 overflow-y-auto">
                            {isLocLoading && (
                              <SelectItem value="__loading" disabled>
                                Loading...
                              </SelectItem>
                            )}
                            {!isLocLoading && locError && (
                              <SelectItem value="__error" disabled>
                                Failed to load locations
                              </SelectItem>
                            )}
                            {!isLocLoading && !locError && locations.length === 0 && (
                              <SelectItem value="__empty" disabled>
                                No locations found
                              </SelectItem>
                            )}
                            {!isLocLoading &&
                              !locError &&
                              locations.map((loc) => (
                                <SelectItem key={loc} value={loc}>
                                  {loc}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="edit-department">Department *</Label>
                        <p className="text-sm text-muted-foreground mb-1">
                          Please provide the department that this cost is associated with.
                        </p>
                        <Select
                          disabled={editingTransaction?.status === "underviewing"}
                          value={editingTransaction.department || ""}
                          onValueChange={(value) => setEditingTransaction({ ...editingTransaction, department: value })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {allDepartments.map((dept) => (
                              <SelectItem key={dept} value={dept}>
                                {dept}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="edit-expense-category">Expense Category</Label>
                        <p className="text-sm text-muted-foreground mb-1">
                          Please select the expense category related to this transaction.
                        </p>
                        <Select
                          disabled={editingTransaction?.status === "underviewing"}
                          value={editingTransaction.expense_category || ""}
                          onValueChange={(value) =>
                            setEditingTransaction({ ...editingTransaction, expense_category: value })
                          }
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue
                              placeholder={isCatLoading ? "Loading categories..." : "Select expense category"}
                            />
                          </SelectTrigger>
                          <SelectContent className="max-h-60 overflow-y-auto">
                            {isCatLoading && (
                              <SelectItem value="__loading" disabled>
                                Loading...
                              </SelectItem>
                            )}
                            {!isCatLoading && catError && (
                              <SelectItem value="__error" disabled>
                                Failed to load categories
                              </SelectItem>
                            )}
                            {!isCatLoading && !catError && expenseCategories.length === 0 && (
                              <SelectItem value="__empty" disabled>
                                No categories found
                              </SelectItem>
                            )}
                            {!isCatLoading &&
                              !catError &&
                              expenseCategories.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {cat}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="edit-class">Class</Label>
                        <p className="text-sm text-muted-foreground mb-1">
                          Please select the class associated with this transaction.
                        </p>
                        <Select
                          disabled={editingTransaction?.status === "underviewing"}
                          value={editingTransaction.class_bnp || ""}
                          onValueChange={(value) => setEditingTransaction({ ...editingTransaction, class_bnp: value })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select class" />
                          </SelectTrigger>
                          <SelectContent>
                            {classOptions.map((cls) => (
                              <SelectItem key={cls} value={cls}>
                                {cls}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="edit-traveler">Traveler</Label>
                        <p className="text-sm text-muted-foreground mb-1">
                          Please write the traveler's name related to this transaction.
                        </p>
                        <Input
                          id="edit-traveler"
                          value={editingTransaction.traveler || ""}
                          onChange={(e) => setEditingTransaction({ ...editingTransaction, traveler: e.target.value })}
                          disabled={editingTransaction?.status === "underviewing"}
                        />
                      </div>

                      <div className="col-span-2">
                        <Label htmlFor="edit-expense-description">Expense Description *</Label>
                        <p className="text-sm text-muted-foreground mb-1">
                          Please provide a brief description of the purchase or any relevant details you'd like to
                          include.
                        </p>
                        <Textarea
                          id="edit-expense-description"
                          value={editingTransaction.expense_description || ""}
                          onChange={(e) =>
                            setEditingTransaction({ ...editingTransaction, expense_description: e.target.value })
                          }
                          disabled={editingTransaction?.status === "underviewing"}
                          rows={3}
                          required
                        />
                      </div>
                    </>
                  )}

                  <div className="col-span-2">
                    <Label htmlFor="multi-lines">Multiple Line Information?</Label>
                    <p className="text-sm text-muted-foreground mb-1">
                      Select "Yes" if this transaction includes multiple line items (e.g. cost splits). If only one line
                      please select "No".
                    </p>
                    <Select
                      id="multi-lines"
                      value={
                        editingTransaction?.hasMultipleLines === null
                          ? undefined
                          : editingTransaction?.hasMultipleLines
                            ? "yes"
                            : "no"
                      }
                      onValueChange={(value) => {
                        const newVal = value === "yes" ? true : value === "no" ? false : null
                        setEditingTransaction({ ...editingTransaction!, hasMultipleLines: newVal })
                      }}
                      disabled={editingTransaction?.status === "underviewing"}
                    >
                      <SelectTrigger className="mt-1 w-full">
                        <SelectValue placeholder="Select option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {editingTransaction?.hasMultipleLines === true && (
                    <div className="col-span-2 space-y-2">
                      <Label>Line Detailed Information</Label>
                      <p className="text-sm text-muted-foreground mb-1">Please add the line information.</p>

                      {(editingTransaction?.split_lines || []).map((line, idx) => (
                        <div key={idx} className="p-4 border rounded-lg bg-gray-50 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>
                                Amount <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Enter amount"
                                value={line.amount ?? ""}
                                onChange={(e) => {
                                  const value = e.target.value
                                  const updated = [...(editingTransaction.split_lines || [])]
                                  updated[idx] = {
                                    ...updated[idx],
                                    amount: value === "" ? undefined : parseFloat(value),
                                  }
                                  setEditingTransaction({ ...editingTransaction, split_lines: updated })
                                }}
                                required
                                disabled={editingTransaction?.status === "underviewing"}
                                className="w-full mt-1"
                              />
                            </div>

                            <div>
                              <Label>
                                Company <span className="text-red-500">*</span>
                              </Label>
                              <Select
                                value={line.company}
                                onValueChange={(value) => {
                                  const updated = [...(editingTransaction.split_lines || [])]
                                  updated[idx] = { ...updated[idx], company: value }
                                  setEditingTransaction({ ...editingTransaction, split_lines: updated })
                                }}
                                disabled={editingTransaction?.status === "underviewing"}
                                required
                              >
                                <SelectTrigger className="w-full mt-1">
                                  <SelectValue placeholder="Select company" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="UT">UT</SelectItem>
                                  <SelectItem value="UF">UF</SelectItem>
                                  <SelectItem value="LSO">LSO</SelectItem>
                                  <SelectItem value="ZEN">ZEN</SelectItem>
                                  <SelectItem value="CUBEWORK">CUBEWORK</SelectItem>
                                  <SelectItem value="CORP">CORP</SelectItem>
                                  <SelectItem value="COFREIGHT">COFREIGHT</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>
                                Location <span className="text-red-500">*</span>
                              </Label>
                              <Select
                                value={line.location}
                                onValueChange={(value) => {
                                  const updated = [...(editingTransaction.split_lines || [])]
                                  updated[idx] = { ...updated[idx], location: value }
                                  setEditingTransaction({ ...editingTransaction, split_lines: updated })
                                }}
                                disabled={editingTransaction?.status === "underviewing"}
                                required
                              >
                                <SelectTrigger className="w-full mt-1">
                                  <SelectValue placeholder="Select location" />
                                </SelectTrigger>
                                <SelectContent className="max-h-60 overflow-y-auto">
                                  {locations.map((loc) => (
                                    <SelectItem key={loc} value={loc}>
                                      {loc}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <Label>
                                Department <span className="text-red-500">*</span>
                              </Label>
                              <Select
                                value={line.department}
                                onValueChange={(value) => {
                                  const updated = [...(editingTransaction.split_lines || [])]
                                  updated[idx] = { ...updated[idx], department: value }
                                  setEditingTransaction({ ...editingTransaction, split_lines: updated })
                                }}
                                disabled={editingTransaction?.status === "underviewing"}
                                required
                              >
                                <SelectTrigger className="w-full mt-1">
                                  <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                                <SelectContent>
                                  {allDepartments.map((dept) => (
                                    <SelectItem key={dept} value={dept}>
                                      {dept}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>Expense Category</Label>
                              <Select
                                value={line.expense_category}
                                onValueChange={(value) => {
                                  const updated = [...(editingTransaction.split_lines || [])]
                                  updated[idx] = { ...updated[idx], expense_category: value }
                                  setEditingTransaction({ ...editingTransaction, split_lines: updated })
                                }}
                                disabled={editingTransaction?.status === "underviewing"}
                              >
                                <SelectTrigger className="w-full mt-1">
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                  {expenseCategories.map((cat) => (
                                    <SelectItem key={cat} value={cat}>
                                      {cat}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <Label>Class</Label>
                              <Select
                                value={line.class_bnp || ""}
                                onValueChange={(value) => {
                                  const updated = [...(editingTransaction.split_lines || [])]
                                  updated[idx] = { ...updated[idx], class_bnp: value }
                                  setEditingTransaction({ ...editingTransaction, split_lines: updated })
                                }}
                                disabled={editingTransaction?.status === "underviewing"}
                              >
                                <SelectTrigger className="w-full mt-1">
                                  <SelectValue placeholder="Select class" />
                                </SelectTrigger>
                                <SelectContent>
                                  {classOptions.map((cls) => (
                                    <SelectItem key={cls} value={cls}>
                                      {cls}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <Label>Traveler</Label>
                              <Input
                                placeholder="Traveler name"
                                value={line.traveler}
                                onChange={(e) => {
                                  const updated = [...(editingTransaction.split_lines || [])]
                                  updated[idx] = { ...updated[idx], traveler: e.target.value }
                                  setEditingTransaction({ ...editingTransaction, split_lines: updated })
                                }}
                                disabled={editingTransaction?.status === "underviewing"}
                                className="w-full mt-1"
                              />
                            </div>
                          </div>

                          <div>
                            <Label>
                              Expense Description <span className="text-red-500">*</span>
                            </Label>
                            <Textarea
                              placeholder="Describe this expense..."
                              value={line.expense_description}
                              onChange={(e) => {
                                const updated = [...(editingTransaction.split_lines || [])]
                                updated[idx] = { ...updated[idx], expense_description: e.target.value }
                                setEditingTransaction({ ...editingTransaction, split_lines: updated })
                              }}
                              rows={2}
                              required
                              disabled={editingTransaction?.status === "underviewing"}
                              className="w-full mt-1"
                            />
                          </div>

                          <div className="flex justify-end">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                if (editingTransaction?.status === "underviewing") return
                                const updated = [...(editingTransaction.split_lines || [])]
                                updated.splice(idx, 1)
                                setEditingTransaction({ ...editingTransaction, split_lines: updated })
                              }}
                              disabled={editingTransaction?.status === "underviewing"}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}

                      <Button
                        variant="outline"
                        className="mt-2 bg-transparent"
                        onClick={() => {
                          setEditingTransaction({
                            ...editingTransaction!,
                            split_lines: [
                              ...(editingTransaction?.split_lines || []),
                              {
                                amount: undefined as any,
                                company: "",
                                location: "",
                                department: "",
                                expense_category: "",
                                traveler: "",
                                expense_description: "",
                              },
                            ],
                          })
                        }}
                        disabled={editingTransaction?.status === "underviewing"}
                      >
                        + Add Line
                      </Button>
                    </div>
                  )}

                  <div className="col-span-2">
                    <Label>Receipt Files</Label>
                    {editingTransaction.uploadedFiles && editingTransaction.uploadedFiles.length > 0 ? (
                      <div className="space-y-2 mt-2">
                        {editingTransaction.uploadedFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border">
                            <File className="h-5 w-5 text-green-600" />
                            <div className="flex-1">
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-green-800 hover:text-green-900 underline"
                              >
                                {file.name}
                              </a>
                              <p className="text-xs text-green-600">{formatFileSize(file.size)}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveFileInModal(idx)}
                              disabled={editingTransaction?.status === "underviewing"}
                              className="text-red-500 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-2">No receipts uploaded</p>
                    )}
                    <Input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      multiple
                      disabled={editingTransaction?.status === "underviewing"}
                      onChange={(e) => {
                        const files = e.target.files
                        if (files && files.length > 0) {
                          Array.from(files).forEach((file) => handleFileUploadInModal(file))
                        }
                      }}
                      className="mt-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      You can upload multiple receipts. Status will change to "Submitted".
                    </p>
                  </div>

                  {isAPUser && (
                    <div className="col-span-2">
                      <Label htmlFor="ap-approved">AP Approved</Label>
                      <Select
                        id="ap-approved"
                        value={String(editingTransaction?.ap_approved ?? 0)}
                        onValueChange={(value) =>
                          setEditingTransaction({ ...editingTransaction!, ap_approved: Number(value) as 0 | 1 })
                        }
                        disabled={editingTransaction?.status === "underviewing"}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select approval status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Yes</SelectItem>
                          <SelectItem value="0">No</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500 mt-1">
                        This field is used for the transaction that do not submit receipt, if no receipt and AP want to
                        approve, please select Yes.
                      </p>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveTransaction} disabled={isSaving === editingTransaction?.id}>
                    {isSaving === editingTransaction?.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
