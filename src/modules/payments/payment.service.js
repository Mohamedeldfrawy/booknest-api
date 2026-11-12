import {
  getOrderForPayment,
  markOrderPaid,
} from "../orders/order.service.js";

const processPayment = async (orderId, userId, cardNumber) => {
  await getOrderForPayment(orderId, userId);

  if (cardNumber.endsWith("0000")) {
    return {
      orderId,
      paymentStatus: "failed",
      orderStatus: "pending",
    };
  }

  await markOrderPaid(orderId, userId);

  return {
    orderId,
    paymentStatus: "succeeded",
    orderStatus: "paid",
  };
};

export { processPayment };