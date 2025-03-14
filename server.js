const express = require("express");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/test", (req, res) => {
    res.json({ message: "✅ Serwer działa poprawnie!" });
});

let sentEmails = [];

// **UWAGA: Brak 'pawel.ruchlicki@emerlog.eu' w klamrach!**
app.post("/send-pdf", async (req, res) => {
  let { name, email, tableData } = req.body;
  // Jeśli chcesz na sztywno, nadpisuj:
  email = "pawel.ruchlicki@emerlog.eu";

  // Sprawdzamy poprawność danych
  if (!name || !email || !tableData || !Array.isArray(tableData)) {
      return res.status(400).json({ message: "❌ Brak wymaganych danych!" });
  }

  console.log("📩 Próba wysyłki e-maila na adres:", email);

  // Tworzenie pliku PDF
  const doc = new PDFDocument();
  const filePath = `./${name.replace(/\s+/g, "_")}_schedule.pdf`;
  const writeStream = fs.createWriteStream(filePath);
  doc.pipe(writeStream);

  doc.fontSize(20).text(`Harmonogram godzinowy dla: ${name}`, { align: "center" });
  doc.moveDown();

  tableData.forEach((row, index) => {
      doc.fontSize(12).text(`${index + 1}. ${row}`, { indent: 10 });
  });

  doc.end();

  writeStream.on("finish", async () => {
      let transporter = nodemailer.createTransport({
          service: "Gmail",
          auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS,
          },
      });

      let mailOptions = {
          from: process.env.EMAIL_USER,
          to: email,
          subject: `Twój harmonogram godzin - ${name}`,
          text: "W załączniku znajdziesz swój harmonogram godzin.",
          attachments: [{ filename: `${name}_schedule.pdf`, path: filePath }],
      };

      try {
          await transporter.sendMail(mailOptions);
          console.log("✅ Email wysłany do:", email);
          sentEmails.push({ name, email, date: new Date().toISOString() });
          res.json({ message: "✅ PDF wysłany!" });

          // Usuwamy plik po 5s
          setTimeout(() => {
              fs.unlinkSync(filePath);
              console.log("🗑️ Plik PDF usunięty:", filePath);
          }, 5000);
      } catch (error) {
          console.error("❌ Błąd wysyłania e-maila:", error);
          res.status(500).json({ message: "❌ Błąd wysyłania e-maila", error });
      }
  });
});

app.get("/sent-emails", (req, res) => {
    res.json(sentEmails);
});

app.listen(PORT, () => console.log(`✅ Serwer działa na porcie ${PORT}`));
