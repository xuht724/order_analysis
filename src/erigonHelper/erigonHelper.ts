import axios from "axios";
import { ERIGON_URL } from "../config";

export class ErigonHelper{
    nodeUrl: string;

    constructor(nodeUrl: string) {
        this.nodeUrl = nodeUrl;
    }

    async getTransactionTrace(transactionHash: string): Promise<any> {
        try {
            const response = await axios.post(this.nodeUrl, {
                jsonrpc: '2.0',
                method: 'debug_traceTransaction',
                params: [transactionHash, {"tracer": "callTracer"}],
                id: 1,
            });

            return response.data.result;
        } catch (error) {
            console.error('Error fetching transaction trace:', error);
            return null;
        }
    }

    async getBlockHeader(blockNumber: bigint): Promise<any> {
        try {
            const response = await axios.post(this.nodeUrl, {
                jsonrpc: '2.0',
                method: 'eth_getBlockByNumber',
                params: [blockNumber.toString(), false],
                id: 1,
            });
            return response.data.result;
        } catch (error) {
            console.error('Error fetching block header:', error);
            return null;
        }
    }

    async getBlock(blockNumber: bigint): Promise<any> {
        try {
            const response = await axios.post(this.nodeUrl, {
                jsonrpc: '2.0',
                method: 'eth_getBlockByNumber',
                params: [blockNumber.toString(), false],
                id: 1,
            });
            return response.data.result;
        } catch (error) {
            console.error('Error fetching block:', error);
            return null;
        }
    }

    async getTransactionReceipt(trxHash: string): Promise<any> {
        try {
            const response = await axios.post(this.nodeUrl, {
                jsonrpc: '2.0',
                method: 'eth_getTransactionReceipt',
                params: [trxHash],
                id: 1,
            });
            return response.data.result;
        } catch (error) {
            console.error('Error fetching trx receipt:', error);
            return null;
        }
    }

    async getTokenDecimal(token: string): Promise<any> {
        try {
            const response = await axios.post(this.nodeUrl, {
                jsonrpc: '2.0',
                method: 'eth_call',
                params: [{
                    to: token,
                    data: "0x313ce567"
                }, 'latest'],
                id: 1,
            });
            return parseInt(response.data.result, 16);
        } catch (error) {
            console.error('Error fetching token decimal:', error);
            return null;
        }
    }
}

// async function main(){
//     let erigonHelper = new ErigonHelper(ERIGON_URL);
//     let block = await erigonHelper.getBlock(19659903n);
//     console.log(block);
    
// }
