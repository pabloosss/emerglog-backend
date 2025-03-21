# Obraz bazowy Node w wersji 18 (slim = minimalna)
FROM node:18-slim

# Upewniamy się, że apt-get jest w miarę świeże
RUN apt-get update && apt-get install -y --no-install-recommends \
  # Jeżeli *nie* potrzebujesz Puppeteera, to te pakiety można pominąć
  # W razie czego dopisz, jeśli kiedyś chcesz wkleić puppeteer (ale chcesz go w Dockerze):
  # gconf-service libasound2 libatk1.0-0 libatk-bridge2.0-0 libc6 libcairo2 libcups2 \
  # libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgdk-pixbuf2.0-0 libgtk-3-0 \
  # libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 \
  # libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 \
  # libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 \
  # libnss3 lsb-release wget xdg-utils
  && rm -rf /var/lib/apt/lists/*

# Wewnątrz kontenera będziemy pracować w /app
WORKDIR /app

# Kopiujemy pliki package.json i package-lock.json
COPY package*.json ./

# Instalujemy zależności
RUN npm install

# Kopiujemy resztę kodu
COPY . .

# Jeżeli Twoja aplikacja nasłuchuje na porcie 10000, to:
EXPOSE 10000

# Komenda startowa
CMD ["npm", "start"]
