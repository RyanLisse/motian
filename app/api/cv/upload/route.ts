import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"]

const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Geen bestand meegegeven" },
        { status: 400 }
      )
    }

    // Validate file type
    const ext = path.extname(file.name).toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        {
          success: false,
          error: "Ongeldig bestandstype. Alleen PDF en Word bestanden zijn toegestaan.",
        },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.includes(file.type) && file.type !== "") {
      return NextResponse.json(
        {
          success: false,
          error: "Ongeldig bestandstype. Alleen PDF en Word bestanden zijn toegestaan.",
        },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: "Bestand is te groot. Maximaal 10MB toegestaan.",
        },
        { status: 400 }
      )
    }

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), "public", "uploads", "cvs")
    await mkdir(uploadDir, { recursive: true })

    // Generate unique filename
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const filename = `${timestamp}-${safeName}`
    const filepath = path.join(uploadDir, filename)

    // Write file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

    return NextResponse.json({
      success: true,
      filename,
      originalName: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString(),
      path: `/uploads/cvs/${filename}`,
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { success: false, error: "Er is een fout opgetreden bij het uploaden." },
      { status: 500 }
    )
  }
}
