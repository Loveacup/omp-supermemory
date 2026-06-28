// src/internals.js — Internal mutable client reference for test injection.
import { supermemoryClient as _defaultClient } from "./client.js";

let _client = _defaultClient;

export function getClient() { return _client; }
export function setClient(c) { _client = c; }
