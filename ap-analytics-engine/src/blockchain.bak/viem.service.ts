import { Injectable, Logger } from '@nestjs/common';
import { createPublicClient, http, fallback, PublicClient, HttpTransport } from 'viem';
import { bsc, polygon } from 'viem/chains';

@Injectable()
export class ViemService {
  private readonly logger = new Logger(ViemService.name);
  public readonly bscClient: PublicClient;
  public readonly polygonClient: PublicClient;

  constructor() {
    this.bscClient = this.createBscClient();
    this.polygonClient = this.createPolygonClient();
  }

  private createBscClient(): PublicClient {
    const envRpc = process.env.RPC_BSC_URL;
    const transports: HttpTransport[] = [];
    
    if (envRpc) {
      transports.push(http(envRpc));
    }

    // Default Public RPCs for BSC
    transports.push(
      http('https://bsc-dataseed.binance.org'),
      http('https://bsc-dataseed1.defibit.io'),
      http('https://binance.llamarpc.com')
    );

    this.logger.log('Inicializando Viem BSC Client com Fallback Rotation...');
    return createPublicClient({
      chain: bsc,
      transport: fallback(transports, { retryCount: 3 }),
    }) as unknown as PublicClient;
  }

  private createPolygonClient(): PublicClient {
    const envRpc = process.env.RPC_POLYGON_URL;
    const transports: HttpTransport[] = [];
    
    if (envRpc) {
      transports.push(http(envRpc));
    }

    // Default Public RPCs for Polygon
    transports.push(
      http('https://polygon-rpc.com'),
      http('https://rpc.ankr.com/polygon'),
      http('https://polygon.llamarpc.com')
    );

    this.logger.log('Inicializando Viem Polygon Client com Fallback Rotation...');
    return createPublicClient({
      chain: polygon,
      transport: fallback(transports, { retryCount: 3 }),
    }) as unknown as PublicClient;
  }
}
