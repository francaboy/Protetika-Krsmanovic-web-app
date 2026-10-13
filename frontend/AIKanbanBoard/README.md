# Stomatologija Krsmanović — Dental Lab & Clinic Manager

Moderna veb aplikacija za praćenje laboratorijskih faza rada, evidenciju pacijenata, koordinaciju sa ordinirajućim doktorima i upravljanje dentalnim timom u realnom vremenu.

Aplikacija je realizovana kao SPA (Single Page Application) koristeći **React + Vite** frontend uz sinhronizaciju preko WebSockets (Socket.IO) tehnologije i PostgreSQL bazu podataka.

---

## 🚀 Ključne funkcionalnosti

* **Kontrolna tabla (Početna):** Real-time analitika i statistika opterećenja laboratorije po fazama rada, hitnim nalozima i stepenu završenosti.
* **Radne table pacijenata (Kanban):** Vizuelno praćenje toka izrade (priprema/modelovanje, 3D print, laboratorija, završeni radovi) uz automatsko pozicioniranje na vrh kolone, prevlačenje (drag & drop) i desni klik brzi meni.
* **AI Planer rada (Google Gemini):** Pametno masovno generisanje i raspoređivanje pacijenata u faze rada na osnovu unesenih imena, ordinirajućih doktora i specifikacija izrade.
* **Moji radovi & Pacijenti:** Pregled svih zaduženih radova filtriranih po tehničaru uz pretragu i selektore prioriteta.
* **Kalendar rokova:** Mjesečni kalendarski pregled rokova predaje sa live vizuelnim indikatorima za hitne i radove koji kasne.
* **Arhiva pacijenata:** Sigurno arhiviranje, masovno brisanje, pražnjenje arhive i mogućnost vraćanja pacijenata nazad u aktivne faze izrade.
* **Dnevnik aktivnosti:** Detaljno hronološko praćenje izmjena i radnji na kartonima u realnom vremenu sa opcijom trajnog čišćenja istorije iz baze.
* **Upravljanje timom & Sigurnost:** Pregled i brisanje zaposlenih na desni klik, upravljanje ulogama (admin/član) i brzi reset zaboravljene lozinke putem sigurnosnog PIN-a ordinacije.
* **Komandni meni (`Ctrl/Cmd + K`):** Globalna brza pretraga pacijenata, radova i navigacionih prečica kroz cijeli sistem.

---

## 🛠️ PERN stack

### Frontend
* **Core:** React 18 / 19, Vite
* **Ruter:** React Router DOM (lokalizovane rute: `/pocetna`, `/pacijenti`, `/kalendar`, `/arhiva`, `/zaposleni`, `/podesavanja`, `/rad/:boardId`)
* **Stilovi & Animacije:** Tailwind CSS, Framer Motion
* **Ikone & UI:** Lucide React, `react-hot-toast`
* **Upravljanje stanjem:** React Context API (`AuthContext`, `BoardsContext`)
* **Mrežna komunikacija:** Axios, Socket.IO Client

### Backend
* **Runtime & Framework:** Node.js, Express
* **Baza podataka:** PostgreSQL (veze sa transakcijama preko `pg` pool-a)
* **Real-time:** Socket.IO Server
* **Vještačka inteligencija:** Google Gen AI SDK (`@google/genai` — Gemini modeli)
* **Autentifikacija:** JWT (JSON Web Tokens), bcryptjs

---

## 📁 Struktura projekta

```text
├── server/
│   ├── config/             # Konfiguracija baze (db.js)
│   ├── controllers/        # Kontroleri (auth, board, task, column, ai, user...)
│   ├── middleware/         # Autentifikacija i provjera pristupa kartonima
│   ├── routes/             # Express API rute
│   ├── services/           # AI servis sa Gemini integracijom
│   ├── utils/              # Pomoćne funkcije i notifikacije
│   └── realtime.js         # Socket.IO logika emitovanja događaja
│
└── src/
    ├── components/
    │   ├── board/          # TaskCard, TaskModal, AIGenerateModal, Kolone
    │   ├── layout/         # Sidebar, Topbar, AppLayout
    │   ├── ui/             # Button, Input, Modal, Avatar, Badge, ConfirmDialog
    │   ├── ActivityFeed.jsx# Dnevnik aktivnosti pacijenta
    │   └── CommandMenu.jsx # Globalna pretraga i prečice
    ├── context/            # AuthContext i BoardsContext
    ├── hooks/              # useWorkspace, useLocalStorage...
    ├── lib/                # api.js, socket.js, utils.js
    ├── pages/              # Dashboard, BoardPage, MyTasks, Calendar, Team, Archive, Settings...
    └── routes/             # ProtectedRoute i PublicOnlyRoute