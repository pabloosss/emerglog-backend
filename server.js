const express = require("express");
const fs = require("fs");
const bodyParser = require("body-parser");
const cors = require("cors");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;

// Dane logowania do Gmaila pobrane z .env
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// Prosty endpoint do testu / lub /admin
app.get("/admin", (req, res) => {
  // jeśli masz admin.html w public, on je pobierze
  res.sendFile(__dirname + "/public/admin.html");
});

// Główny endpoint - strona
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// Endpoint do generowania i wysyłania PDF
app.post("/send-pdf", async (req, res) => {
  const { name, hours } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Brak imienia i nazwiska!" });
  }
  // hours = 0, jeśli nie zlecenie
  const doc = new PDFDocument();
  const fileName = `${name.replace(/\s+/g, "_")}_schedule.pdf`;
  const writeStream = fs.createWriteStream(fileName);
  doc.pipe(writeStream);

  // Napis "Rm" czarny, "Logistics" – niebieski
  doc.fontSize(20);
  doc.fillColor("black").text("Rm", { continued: true });
  doc.fillColor("blue").text("Logistics", { continued: false });
  doc.fillColor("black").moveDown();

  doc.fontSize(16).text(`Harmonogram dla: ${name}`);
  doc.moveDown();
  doc.fontSize(12).text(`Liczba godzin: ${hours || "Brak (umowa o pracę)"}`);
  doc.text(`Data wygenerowania: ${new Date().toLocaleDateString("pl-PL")}`);
  doc.moveDown();
  doc.text("Podpis: __________________________");
  doc.end();

  writeStream.on("finish", async () => {
    try {
      await sendEmailToPawel(name, fileName);
      res.json({ message: "Wysłano e-mail z harmonogramem!" });
    } catch (error) {
      console.error("Błąd wysyłania e-maila:", error);
      res.status(500).json({ message: "Błąd wysyłania e-maila", error });
    } finally {
      fs.unlink(fileName, () => {
        console.log("Usunięto plik:", fileName);
      });
    }
  });
});

async function sendEmailToPawel(fullName, pdfFile) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: EMAIL_USER,
    to: "pawel.ruchlicki@emerlog.eu", // ZAWSZE do Pawła
    subject: "Harmonogram - RmLogistics",
    text: `Cześć,\n\nZałączam harmonogram dla: ${fullName}\n\nPozdrawiam,\nRmLogistics`,
    attachments: [
      {
        filename: pdfFile,
        path: `./${pdfFile}`,
      },
    ],
  };

  await transporter.sendMail(mailOptions);
  console.log("Wysłano mail do Pawła z plikiem:", pdfFile);
}

// Uruchom serwer
app.listen(PORT, () => {
  console.log(`✅ Serwer działa na porcie ${PORT}`);
});
