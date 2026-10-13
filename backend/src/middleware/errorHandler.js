// Centralizovani rukovalac greškama. Uvijek stoji na kraju niza middleware-a.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  const status = err.statusCode || 500;

  if (status >= 500) {
    console.error("Serverska greška:", err);
  }

  // Postgres narušavanje jedinstvenosti (unique violation) -> 409
  if (err.code === "23505") {
    return res.status(409).json({ error: "Zapis sa ovim podacima već postoji" });
  }

  res.status(status).json({
    error: status >= 500 ? "Došlo je do unutrašnje greške na serveru" : err.message,
  });
};

const notFoundHandler = (_req, res) => {
  res.status(404).json({ error: "Tražena ruta ili resurs nije pronađen" });
};

module.exports = { errorHandler, notFoundHandler };