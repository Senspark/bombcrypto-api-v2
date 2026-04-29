import express from "express";
import cors from "cors";
import Dependencies from "./Dependencies";
import Routes from "./Routes";

const dependencies = new Dependencies();
const app = express();
const port = dependencies.envConfig.port;

app.use(cors());
app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
    dependencies.logger.log(`${req.method} ${req.url}`);
    next();
});

const routes = new Routes(dependencies);
routes.register(app);

if (process.env.NODE_ENV !== "test") {
    app.listen(port, () => {
        dependencies.logger.log(`PVP Mode Server running on http://localhost:${port}`);
    });
}

export { app, dependencies };
