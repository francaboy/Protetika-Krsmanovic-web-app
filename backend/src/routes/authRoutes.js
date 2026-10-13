const express = require("express");
const {
  register,
  login,
  resetPasswordWithPin,
  me,
} = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/reset-password-pin", resetPasswordWithPin);
router.get("/me", requireAuth, me);

module.exports = router;