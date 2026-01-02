import { Router, Request, Response } from 'express';
import {getServerConfig, ServerConfig, ServerConfigJson} from "../globals";

const serverConfig = getServerConfig();
export const router = Router();

router.get('/', (_: Request, res: Response) => {
    console.log("GET /config");
    const toServerConfigJson = (config: ServerConfig): ServerConfigJson => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { progressWriter, ...json } = config;
        return json;
    };
    res.json(toServerConfigJson(serverConfig));
})