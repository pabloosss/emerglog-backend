const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const fs = require("fs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;

const EMAIL_USER=process.env.EMAIL_USER;
const EMAIL_PASS=process.env.EMAIL_PASS;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// ewentualny admin
app.get("/admin",(req,res)=>{
  res.sendFile(__dirname+"/public/admin.html");
});

// Strona główna
app.get("/",(req,res)=>{
  res.sendFile(__dirname+"/public/index.html");
});

// Odbiór pliku PDF w base64
app.post("/send-pdf", async (req,res)=>{
  try{
    const { fileName, base64 }=req.body;
    if(!fileName||!base64){
      return res.status(400).json({message:"Brak pliku (base64)!"});
    }
    // Zapis tymczasowy
    const pdfBuff=Buffer.from(base64,"base64");
    fs.writeFileSync(fileName,pdfBuff);

    // Wysyłka e-mail
    await sendEmail(fileName);

    // Usuwanie pliku
    fs.unlinkSync(fileName);

    return res.json({message:"PDF wysłany do Pawła!"});
  }catch(e){
    console.error("Błąd w /send-pdf:",e);
    return res.status(500).json({message:"Błąd w /send-pdf",error:e});
  }
});

async function sendEmail(filePath){
  const transporter=nodemailer.createTransport({
    service:"gmail",
    auth:{ user:EMAIL_USER, pass:EMAIL_PASS }
  });

  const mailOptions={
    from:EMAIL_USER,
    to:"pawel.ruchlicki@emerlog.eu",
    subject:"Harmonogram RmLogistics",
    text:"Załącznik w PDF.",
    attachments:[{filename:filePath, path:`./${filePath}`}]
  };

  await transporter.sendMail(mailOptions);
  console.log("Mail wysłany z załącznikiem:",filePath);
}

app.listen(PORT,()=>{
  console.log(`✅ Serwer działa na porcie ${PORT}`);
});
