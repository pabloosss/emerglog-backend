const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const fs = require("fs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

// Admin panel
app.get("/admin", (req, res) => {
  res.sendFile(__dirname + "/public/admin.html"); // jeśli masz admin.html
});

// Strona główna
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// Endpoint do przyjmowania gotowego PDF (base64)
app.post("/send-pdf", async (req, res) => {
  try {
    const { fileName, base64 } = req.body;
    if (!fileName || !base64) {
      return res.status(400).json({ message: "Brak pliku (base64)!" });
    }

    // Zapis tymczasowy
    const pdfBuffer = Buffer.from(base64, "base64");
    fs.writeFileSync(fileName, pdfBuffer);

    // Wysyłka mailem
    await sendEmailWithPDF(fileName);

    // Usuwanie pliku
    fs.unlinkSync(fileName);

    return res.json({ message: "PDF wysłany do Pawła!" });
  } catch (error) {
    console.error("Błąd w /send-pdf:", error);
    return res.status(500).json({ message: "Błąd /send-pdf", error });
  }
});

async function sendEmailWithPDF(filePath) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    },
  });

  const mailOptions = {
    from: EMAIL_USER,
    to: "pawel.ruchlicki@emerlog.eu", // Zawsze do Pawła
    subject: "Harmonogram RmLogistics",
    text: "Załączam harmonogram w pliku PDF.",
    attachments: [
      {
        filename: filePath,
        path: `./${filePath}`
      }
    ]
  };

  await transporter.sendMail(mailOptions);
  console.log("Wysłano e-mail do Pawła:", filePath);
}

app.listen(PORT, () => {
  console.log(`✅ Serwer działa na porcie ${PORT}`);
});
