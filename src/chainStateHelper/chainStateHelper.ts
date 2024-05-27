import { PublicClient, createPublicClient, erc20Abi, getAddress, getContract, http } from "viem";
import { mainnet } from "viem/chains";
import { HTTP_NODE_URL } from "../config";
import { ipc } from 'viem/node'

export class ChainStateHelper {
    publicClient: PublicClient;
    nodeUrl: string;
    TokenSymbolMap: Map<string, string> = new Map();

    constructor(nodeUrl: string, ipcUrl?: string) {
        this.nodeUrl = nodeUrl;
        if (ipcUrl) {
            this.publicClient = createPublicClient({
                chain: mainnet,
                transport: ipc(ipcUrl)
            })
        } else {
            this.publicClient = createPublicClient({
                chain: mainnet,
                transport: http(nodeUrl)
            })
        }
    }

    async getToken(addr: string){
        if(this.TokenSymbolMap.has(addr)){
            return this.TokenSymbolMap.get(addr)
        }else{
            let tokenc = getContract({
                address: getAddress(addr),
                abi:erc20Abi,
                client:this.publicClient
            })
            try{
                let symbol = await tokenc.read.symbol();
                this.TokenSymbolMap.set(addr,symbol);
                return symbol
            }catch(error){
                this.TokenSymbolMap.set(addr,addr);
                return addr
            }
        }
    }


    async downloadBlock(blockNumber: number | bigint, inculudingFullTrx: boolean) {
        try {
            let block = await this.publicClient.getBlock({
                blockNumber: BigInt(blockNumber),
                includeTransactions: inculudingFullTrx
            })
            return block
        } catch (error) {
            throw new Error(`Fail to get block, blockNumber ${blockNumber}`);
        }
    }

    // async downloadReceiptsViem(trxHashs: string[], blockNumber?: bigint | number) {
    //     let receipts: any[] = []
    //     for (const trxHash of trxHashs) {
    //         let hash = trxHash as `0x${string}`
    //         try {
    //             let receipt = await this.publicClient.getTransactionReceipt({ hash: hash })
    //             receipts.push(receipt)
    //         } catch (error) {
    //             throw error;
    //         }
    //     }
    //     return receipts;
    // }


    async downloadReceipts(trxHashs: string[], blockNumber?: bigint | number) {
        try {
            let reqs: any[] = [];
            for (let i = 0; i < trxHashs.length; i++) {
                reqs.push({
                    method: 'eth_getTransactionReceipt',
                    params: [trxHashs[i]],
                    id: i,
                    jsonrpc: '2.0'
                })
            }

            const res = await fetch(HTTP_NODE_URL, {
                method: 'POST',
                body: JSON.stringify(reqs),
                headers: { 'Content-Type': 'application/json' }
            })
            let receipts = res.json();
            return receipts
        } catch (error) {
            throw new Error(`Fail to trx receipts, blockNumber: ${blockNumber}`)
        }
    }
}