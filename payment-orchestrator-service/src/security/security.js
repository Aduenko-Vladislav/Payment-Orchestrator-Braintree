import crypto from "crypto";

export function hmacSignature(buffer, secret) {
    return crypto.createHmac("sha256", secret).update(buffer).digest("hex");
    
}