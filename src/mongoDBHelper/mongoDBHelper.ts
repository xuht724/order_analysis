import winston, { createLogger, transports } from "winston";
import mongodb, { MongoClient } from 'mongodb';
import { mongodb_url } from "../config";


export class MongoDBHelper {
    client: MongoClient;
    db!: mongodb.Db;
    logger: winston.Logger;

    constructor() {
        this.client = new MongoClient(mongodb_url, { monitorCommands: true });
        this.logger = createLogger({
            transports: [new transports.File({ filename: "./log/mongodb.log" })]
        });
    }

    public async connect() {
        await this.client.connect();
        this.db = this.client.db('Block');
    }

    public close() {
        this.client.close();
    }

    public async writeV6OrderTrx(data:any){
        try {
            await this.db.collection('v6OrderTrx').insertOne(data);
        } catch (error) {
            // console.log(error);
            this.logger.info(error);
        }
    }

}