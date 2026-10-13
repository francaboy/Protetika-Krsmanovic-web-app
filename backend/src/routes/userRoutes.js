const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  searchUsers,
  updateProfile,
  changePassword,
  updateUserRole,
  deleteUser,
} = require("../controllers/userController");

const router = express.Router();

router.use(requireAuth);

router.get("/search", searchUsers);
router.put("/profile", updateProfile);
router.put("/change-password", changePassword);
router.patch("/:id/role", updateUserRole);
router.delete("/:id", deleteUser);

module.exports = router;