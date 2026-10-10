import app from "./app.js";
import { configuration } from "./config/env.js";
app.listen(configuration().PORT, () => console.log("Blue Bug API ready"));
