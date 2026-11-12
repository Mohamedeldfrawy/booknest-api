import { processPayment } from "./payment.service.js";

const createPaymentController = async (req, res) => {
  const { orderId, cardNumber } = req.body;
  const payment = await processPayment(
    orderId,
    req.user.userId,
    cardNumber,
  );

  return res.status(200).json({
    status: "success",
    message:
      payment.paymentStatus === "succeeded"
        ? "Payment successful"
        : "Payment failed",
    data: payment,
  });
};

export { createPaymentController };