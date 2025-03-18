//// server.js ////
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer"); // <— kluczowe
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: "2mb" }));
app.use(express.static("public"));

// Dane do maila
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

// Endpoint testowy / cokolwiek
app.get("/", (req, res)=>{
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Endpoint generujący PDF
app.post("/send-data", async (req, res)=>{
  try {
    const { name, totalHours } = req.body;
    if(!name) {
      return res.status(400).json({message:"Brak name"});
    }

    // 1) Generujemy dynamiczny HTML z Twoją tabelą
    const htmlContent = buildHtmlContent(name, totalHours);

    // 2) Odpalamy Puppeteer => generujemy PDF
    const pdfPath = `${Date.now()}_harmonogram.pdf`;
    await createPDFviaPuppeteer(htmlContent, pdfPath);

    // 3) Wysyłamy mailem
    await sendPdfByMail(pdfPath);

    // 4) Usuwamy
    fs.unlinkSync(pdfPath);

    res.json({message: "Wysłano mail z PDF do Pawła!"});
  } catch(err){
    console.error("Błąd send-data =>", err);
    res.status(500).json({message:"Błąd serwera", error:String(err)});
  }
});

// Generowanie PDF
async function createPDFviaPuppeteer(htmlString, outFile){
  // uruchamiasz headless Chrome
  const browser = await puppeteer.launch({
    args:["--no-sandbox","--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  // Ładujesz swojego HTML-a w newPage
  await page.setContent(htmlString, { waitUntil:"networkidle0" });

  // PDF
  await page.pdf({
    path: outFile,
    format: "A4",
    printBackground: true
  });

  await browser.close();
}

// Prosty HTML => w realu wstawisz tu swoje CSS, bootstrap itp.:
function buildHtmlContent(name, hours){
  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8"/>
      <title>Harmonogram</title>
      <style>
        body { font-family: Arial, sans-serif; margin:20px; }
        table { border-collapse: collapse; width: 100%; }
        th,td { border:1px solid #222; padding:8px; text-align:center; }
        thead { background:#eee; font-weight:bold; }
      </style>
    </head>
    <body>
      <h1 style="color:blue;">RmLogistics</h1>
      <h2>Harmonogram dla: ${name}</h2>
      <p>Liczba godzin: ${hours}</p>

      <table>
        <thead>
          <tr><th>Dzień</th><th>Godz. start</th><th>Godz. end</th><th>Sum</th></tr>
        </thead>
        <tbody>
          ${mockTableRows(hours)}
        </tbody>
     
