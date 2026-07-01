import serverless from "serverless-http";
import { createServer } from "../server/index";

export default serverless(createServer());
