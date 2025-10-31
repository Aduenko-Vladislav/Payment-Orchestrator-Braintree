import braintree from "braintree";
import dotenv from "dotenv";

dotenv.config();

export const gateway = new braintree.BraintreeGateway({
  environment: braintree.Environment.Sandbox, 
  merchantId: process.env.MERCHANT_ID,
  publicKey: process.env.PUBLIC_KEY,
  privateKey: process.env.PRIVATE_KEY,
});