import crypto from "crypto"

const key = "xxxxx-xxxx-xxx-xxxx-xxxxx.jpeg"
const exp = Math.floor(Date.now() / 1000) + 300
const data = `${key}:${exp}`

const sig = crypto
    .createHmac("sha256", "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET")
    .update(data)
    .digest("base64")

console.log(
    `http://127.0.0.1:8787?key=${encodeURIComponent(
        key
    )}&exp=${exp}&sig=${encodeURIComponent(sig)}`
)
