const { Server } = require("socket.io");
const { verifyToken } = require("../utils/jwt");
const { setIo, boardRoom, userRoom } = require("../realtime");

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Autentifikacija svakog socketa putem JWT tokena proslijeđenog u handshake.auth.token
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Autentifikacija je obavezna"));
      const decoded = verifyToken(token);
      socket.user = { id: decoded.id, name: decoded.name, email: decoded.email };
      // Čuvamo podatke i na socket.data kako bi ih io.fetchSockets() mogao pročitati
      socket.data.user = socket.user;
      next();
    } catch {
      next(new Error("Nevažeći autentifikacioni token"));
    }
  });

  io.on("connection", (socket) => {
    const { user } = socket;

    // Automatsko spajanje korisnika u njegovu ličnu sobu za direktna obavještenja
    if (user?.id) {
      socket.join(userRoom(user.id));
    }

    // Ulazak na karton pacijenta (board)
    socket.on("board:join", async (boardId, ack) => {
      try {
        if (!boardId) {
          if (ack) ack({ ok: false, error: "Identifikator pacijenta je obavezan" });
          return;
        }

        const room = boardRoom(boardId);
        socket.join(room);

        // Obavijesti ostale članove da je neko otvorio karton
        socket.to(room).emit("presence:join", {
          user: { id: user.id, name: user.name },
          boardId,
        });

        // Pošalji korisniku listu svih prisutnih na kartonu (bez duplikata)
        const sockets = await io.in(room).fetchSockets();
        const seen = new Set([user.id]);
        const viewers = [];
        for (const s of sockets) {
          const u = s.data?.user;
          if (!u || seen.has(u.id)) continue;
          seen.add(u.id);
          viewers.push({ id: u.id, name: u.name });
        }
        socket.emit("presence:sync", { boardId, users: viewers });

        if (ack) ack({ ok: true });
      } catch (err) {
        if (ack) ack({ ok: false, error: "Neuspjelo otvaranje pacijenta u realnom vremenu" });
      }
    });

    // Napuštanje kartona pacijenta
    socket.on("board:leave", (boardId) => {
      const room = boardRoom(boardId);
      socket.leave(room);
      socket.to(room).emit("presence:leave", {
        user: { id: user.id, name: user.name },
        boardId,
      });
    });

    // Prikaz kursora i indikatora kretanja u realnom vremenu
    socket.on("presence:cursor", ({ boardId, x, y }) => {
      socket.to(boardRoom(boardId)).emit("presence:cursor", {
        user: { id: user.id, name: user.name },
        x,
        y,
      });
    });

    // Prilikom prekida veze, obavijesti sve sobe u kojima je korisnik bio prisutan
    socket.on("disconnecting", () => {
      for (const room of socket.rooms) {
        if (room === socket.id) continue;
        socket.to(room).emit("presence:leave", {
          user: { id: user.id, name: user.name },
        });
      }
    });
  });

  setIo(io);
  return io;
};

module.exports = { initSocket };