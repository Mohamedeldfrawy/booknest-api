import { toPublicUser } from "../users/user.mapper.js";
import { login } from "./auth.service.js";

const loginUser = async (req, res) => {
  const { user, token } = await login(req.body);

  return res.status(200).json({
    status: "success",
    message: "Login successful",
    data: {
      user: toPublicUser(user),
      token,
    },
  });
};

export { loginUser };