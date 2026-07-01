#!/usr/bin/env node
/**
 * Regenerate TypeScript gRPC client stubs from proto/airbar_finance_v1.proto.
 * Uses grpc-tools bundled protoc + ts-proto. Generated output is committed.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const protoc = path.join(root, 'node_modules', '.bin', 'grpc_tools_node_protoc');
const tsProto = path.join(root, 'node_modules', '.bin', 'protoc-gen-ts_proto');
const outDir = path.join(root, 'src', 'adapters', 'grpc-client', 'generated');
fs.mkdirSync(outDir, { recursive: true });
const protoFile = path.join(root, 'proto', 'airbar_finance_v1.proto');
const googleProtos = path.join(root, 'node_modules', 'google-proto-files');

const args = [
  `--plugin=protoc-gen-ts_proto=${tsProto}`,
  `--ts_proto_out=${outDir}`,
  '--ts_proto_opt=esModuleInterop=true,outputServices=grpc-js,env=node,useOptionals=messages,exportCommonSymbols=false',
  `--proto_path=${path.join(root, 'proto')}`,
  `--proto_path=${googleProtos}`,
  protoFile,
];

const result = spawnSync(protoc, args, { stdio: 'inherit', cwd: root });
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Generated gRPC stubs in ${outDir}`);
