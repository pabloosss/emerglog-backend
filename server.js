const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;

// Dane logowania do Gmail (z .env)
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// Przykład: panel admina
app.get("/admin", (req, res) => {
  // Załóżmy, że plik admin.html jest w folderze public
  res.sendFile(__dirname + "/public/admin.html");
});

// Strona główna
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// Endpoint do generowania i wysyłania PDF
app.post("/send-pdf", async (req, res) => {
  const { name, hours } = req.body;
  if (!name) {
    return res.status(400).json({ message: "Brak imienia i nazwiska!" });
  }

  // Generujemy minimalny PDF (zawiera np. info: Imię, Nazwisko, Liczba godzin)
  const fileName = `${name.replace(/\s+/g, "_")}_schedule.pdf`;
  const doc = new PDFDocument();
  const writeStream = fs.createWriteStream(fileName);
  doc.pipe(writeStream);

  // Nagłówek RmLogistics
  doc.fontSize(24);
  doc.fillColor("black").text("Rm", { continued: true });
  doc.fillColor("blue").text("Logistics", { continued: false });
  doc.moveDown();

  doc.fontSize(16).fillColor("black").text(`Harmonogram dla: ${name}`);
  doc.moveDown();
  doc.fontSize(12).text(`Liczba godzin (zlecenie): ${hours || "(umowa o pracę)"}`);
  doc.text(`Data generacji: ${new Date().toLocaleString("pl-PL")}`);
  doc.text("Dokładny harmonogram znajduje się w pliku HTML (tabela).");
  doc.moveDown(2);

  doc.text("Pozdrawiamy,");
  doc.text("RmLogistics");
  doc.end();

  writeStream.on("finish", async () => {
    try {
      await sendEmailWithPDF(name, fileName);
      res.json({ message: "Wysłano e-mail z harmonogramem!" });
    } catch (error) {
      console.error("Błąd wysyłania e-maila:", error);
      res.status(500).json({ message: "Błąd wysyłania e-maila", error });
    } finally {
      // Usunięcie pliku
      fs.unlink(fileName, (err) => {
        if (err) console.error("Błąd unlink pliku:", err);
      });
    }
  });
});

async function sendEmailWithPDF(fullName, pdfPath) {
  // Transporter
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  // ZAWSZE do Pawła
  const mailOptions = {
    from: EMAIL_USER,
    to: "pawel.ruchlicki@emerlog.eu",
    subject: "Harmonogram RmLogistics",
    text: `Cześć Pawle,\n\nW załączniku harmonogram dla: ${fullName}.\n\nPozdrawiam,\nRmLogistics`,
    attachments: [
      {
        filename: pdfPath,
        path: `./${pdfPath}`,
      },
    ],
  };

  await transporter.sendMail(mailOptions);
  console.log(`Email wysłany do Pawła (pdf: ${pdfPath})`);
}

// Start
app.listen(PORT, () => {
  console.log(`✅ Serwer działa na porcie ${PORT}`);
});
