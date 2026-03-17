// main app
const app = require("./src/app");
require("dotenv").config();

// DB
const connectDB = require("./src/db/db");
connectDB();

app.listen(process.env.PORT, () => {
    console.log("Server Connected 🎊");
});
