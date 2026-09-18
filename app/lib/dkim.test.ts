import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import { evaluateDkimRecords, type DkimRecordState } from "./dkim";

const rsaPublicKey = createRsaPublicKey(1024);
const weakRsaPublicKey = createRsaPublicKey(512);
const ed25519PublicKey = createEd25519PublicKey();

const validRsaRecord = `v=DKIM1; k=rsa; p=${rsaPublicKey}`;

describe("evaluateDkimRecords", () => {
  const cases: Array<{
    name: string;
    records: string[];
    expected: DkimRecordState;
  }> = [
    {
      name: "1024ビットのRSA鍵を利用可能と判定する",
      records: [validRsaRecord],
      expected: "usable",
    },
    {
      name: "vタグを省略したRSA鍵を利用可能と判定する",
      records: [`k=rsa; p=${rsaPublicKey}`],
      expected: "usable",
    },
    {
      name: "空白で折り返した公開鍵を利用可能と判定する",
      records: [`v=DKIM1; p=${insertWhitespace(rsaPublicKey)}`],
      expected: "usable",
    },
    {
      name: "Ed25519鍵を利用可能と判定する",
      records: [`v=DKIM1; k=ed25519; p=${ed25519PublicKey}`],
      expected: "usable",
    },
    {
      name: "pタグが空の鍵を失効と判定する",
      records: ["v=DKIM1; p="],
      expected: "revoked",
    },
    {
      name: "pタグがない鍵を構文不正と判定する",
      records: ["v=DKIM1; k=rsa"],
      expected: "invalid",
    },
    {
      name: "重複したタグを構文不正と判定する",
      records: [`v=DKIM1; p=; p=${rsaPublicKey}`],
      expected: "invalid",
    },
    {
      name: "不正な未知タグ名を構文不正と判定する",
      records: [`bad name=foo; p=${rsaPublicKey}`],
      expected: "invalid",
    },
    {
      name: "記号を含む未知タグ名を構文不正と判定する",
      records: [`x!=foo; p=${rsaPublicKey}`],
      expected: "invalid",
    },
    {
      name: "先頭の空要素を構文不正と判定する",
      records: [`;v=DKIM1; p=${rsaPublicKey}`],
      expected: "invalid",
    },
    {
      name: "途中の空要素を構文不正と判定する",
      records: [`v=DKIM1;; p=${rsaPublicKey}`],
      expected: "invalid",
    },
    {
      name: "末尾のセミコロンを許可する",
      records: [`v=DKIM1; p=${rsaPublicKey};`],
      expected: "usable",
    },
    {
      name: "vタグが先頭でない鍵を構文不正と判定する",
      records: [`p=${rsaPublicKey}; v=DKIM1`],
      expected: "invalid",
    },
    {
      name: "DKIM1以外のバージョンを構文不正と判定する",
      records: [`v=dkim1; p=${rsaPublicKey}`],
      expected: "invalid",
    },
    {
      name: "sha256を許可しない鍵を構文不正と判定する",
      records: [`v=DKIM1; h=sha1; p=${rsaPublicKey}`],
      expected: "invalid",
    },
    {
      name: "sha256を含む鍵を利用可能と判定する",
      records: [`v=DKIM1; h=sha1:sha256; p=${rsaPublicKey}`],
      expected: "usable",
    },
    {
      name: "空のハッシュアルゴリズム要素を構文不正と判定する",
      records: [`v=DKIM1; h=sha256::sha1; p=${rsaPublicKey}`],
      expected: "invalid",
    },
    {
      name: "ハイフンで終わるハッシュアルゴリズムを構文不正と判定する",
      records: [`v=DKIM1; h=sha256:future-; p=${rsaPublicKey}`],
      expected: "invalid",
    },
    {
      name: "未対応の鍵種別を構文不正と判定する",
      records: [`v=DKIM1; k=unknown; p=${rsaPublicKey}`],
      expected: "invalid",
    },
    {
      name: "メール用途を許可しない鍵を構文不正と判定する",
      records: [`v=DKIM1; s=other; p=${rsaPublicKey}`],
      expected: "invalid",
    },
    {
      name: "メール用途を含む鍵を利用可能と判定する",
      records: [`v=DKIM1; s=other:email; p=${rsaPublicKey}`],
      expected: "usable",
    },
    {
      name: "空のサービス種別要素を構文不正と判定する",
      records: [`v=DKIM1; s=email::other; p=${rsaPublicKey}`],
      expected: "invalid",
    },
    {
      name: "空のフラグ要素を構文不正と判定する",
      records: [`v=DKIM1; t=y::s; p=${rsaPublicKey}`],
      expected: "invalid",
    },
    {
      name: "正しいフラグ一覧を持つ鍵を利用可能と判定する",
      records: [`v=DKIM1; t=y:s; p=${rsaPublicKey}`],
      expected: "usable",
    },
    {
      name: "1024ビット未満のRSA鍵を構文不正と判定する",
      records: [`v=DKIM1; p=${weakRsaPublicKey}`],
      expected: "invalid",
    },
    {
      name: "余分なBase64パディングを構文不正と判定する",
      records: [`v=DKIM1; p=${rsaPublicKey}===`],
      expected: "invalid",
    },
    {
      name: "途中にパディングがある公開鍵を構文不正と判定する",
      records: [`v=DKIM1; p=${rsaPublicKey.slice(0, 20)}=${rsaPublicKey.slice(20)}`],
      expected: "invalid",
    },
    {
      name: "無関係なTXTレコードを未設定として扱う",
      records: ["v=spf1 -all"],
      expected: "missing",
    },
    {
      name: "無関係なTXTレコードが共存してもDKIM鍵を利用可能と判定する",
      records: [validRsaRecord, "v=spf1 -all"],
      expected: "usable",
    },
    {
      name: "大文字のタグ名を標準タグとして扱わない",
      records: [`V=DKIM1; P=${rsaPublicKey}`],
      expected: "missing",
    },
    {
      name: "利用可能な鍵と失効した鍵の共存を複数と判定する",
      records: [validRsaRecord, "v=DKIM1; p="],
      expected: "multiple",
    },
  ];

  it.each(cases)("$name", ({ records, expected }) => {
    expect(evaluateDkimRecords(records).state).toBe(expected);
  });
});

function createRsaPublicKey(modulusLength: number): string {
  const { publicKey } = generateKeyPairSync("rsa", {
    modulusLength,
    publicKeyEncoding: {
      format: "der",
      type: "pkcs1",
    },
    privateKeyEncoding: {
      format: "pem",
      type: "pkcs8",
    },
  });

  return publicKey.toString("base64");
}

function createEd25519PublicKey(): string {
  const { publicKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: {
      format: "der",
      type: "spki",
    },
    privateKeyEncoding: {
      format: "pem",
      type: "pkcs8",
    },
  });

  return publicKey.subarray(-32).toString("base64");
}

function insertWhitespace(value: string): string {
  const middle = Math.floor(value.length / 2);

  return `${value.slice(0, middle)} ${value.slice(middle)}`;
}
