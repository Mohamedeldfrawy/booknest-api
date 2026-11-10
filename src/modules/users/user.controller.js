import { getProfile, register, updateProfile } from "./user.service.js";
import { toPublicUser } from "./user.mapper.js";

const registerUser = async (req, res) => {
  const { user, token } = await register(req.body);

  return res.status(201).json({
    status: "success",
    message: "User registered successfully",
    data: {
      user: toPublicUser(user),
      token,
    },
  });
};

export { registerUser };

const getCurrentUser = async (req, res) => {
  const user = await getProfile(req.user.userId);

  return res.status(200).json({
    status: "success",
    data: {
      user: toPublicUser(user),
    },
  });
};

const updateCurrentUser = async (req, res) => {
  const user = await updateProfile(req.user.userId, req.body);

  return res.status(200).json({
    status: "success",
    data: {
      user: toPublicUser(user),
    },
  });
};

export { getCurrentUser, updateCurrentUser };