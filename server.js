//////////////// server.js ////////////////
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const fs = require("fs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;

// Odczyt z .env
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

app.use(cors());
app.use(bodyParser.json());
// pliki statyczne
app.use(express.static("public"));

// ewentualny admin
app.get("/admin", (req, res)=>{
  res.sendFile(__dirname + "/public/admin.html");
});

// Strona główna
app.get("/", (req, res)=>{
  res.sendFile(__dirname + "/public/index.html");
});

// Odbiera PDF (base64) i wysyła do Pawła
app.post("/send-pdf", async (req, res)=>{
  try {
    const { fileName, base64 } = req.body;
    if(!fileName||!base64){
      return res.status(400).json({ message:"Brak parametru fileName/base64" });
    }
    // Tworzymy tymczasowy plik na serwerze
    fs.writeFileSync(fileName, Buffer.from(base64,"base64"));

    await sendEmail(fileName);

    // usuwamy plik
    fs.unlinkSync(fileName);

    return res.json({message:"PDF wysłany do Pawła!"});
  } catch(e){
    console.error("Błąd /send-pdf", e);
    return res.status(500).json({message:"Błąd serwera", error:e});
  }
});

async function sendEmail(filePath){
  console.log("sendEmail() =>", filePath);
  // transporter
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    }
  });
  // opakowanie maila
  const mailOptions = {
    from: EMAIL_USER,
    to: "pawel.ruchlicki@emerlog.eu",
    subject: "Harmonogram RmLogistics",
    text: "Załącznik w PDF.",
    attachments: [{
      filename: filePath,
      path: "./"+filePath
    }]
  };
  // wysyłka
  await transporter.sendMail(mailOptions);
  console.log("Wysłano mail z załącznikiem ->", filePath);
}

app.listen(PORT, ()=>{
  console.log(`Serwer działa na porcie ${PORT}`);
});
