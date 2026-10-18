// Public keys of UIDAI's offline signing certificates, from https://uidai.gov.in/en/data-and-download
// (Secure QR Code and Offline e-KYC sections). Used only to check that an Aadhaar QR was signed by UIDAI.
export const UIDAI_KEYS: { file: string; cn: string; spki: string }[] = [
  {
    "file": "uidai_12_06_18_cer.cer",
    "cn": "DS UNIQUE IDENTIFICATION AUTHORITY OF INDIA 7",
    "spki": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv1DSK9/qrW8RX1vDZMsE8xiiyJlj+6xxDtu+nSZDW9C/iajSqJ2QgLvRgweTw4suzzxZQseOE+kbqlbesNHc0lQjt9T+CGYrUTCbMI/a3zZbr3vPxz3VlN7iqr8U6ISUN53x+6qAc4Z/Pc66IqJA6zXBPKFZiHHMmi00eM14HgNWrLEkYHE5geBmBgEevznskS4Q+sJVX+4seJ/zadc35O4G6gvWZatlsB5STGSdes4TqF1k0FV4a0CF7vAzpUA4EtQohl6dnKWpfWYAJUxbSrH1OCLFBn1ABe9Yw5iZkIMFYauhyFzP16XCiG91TPoORIJ8ssIR9uf21o6rD82OJwIDAQAB"
  },
  {
    "file": "uidai_offline_publickey_17022026.cer",
    "cn": "DS Unique Identification Authority of India 05",
    "spki": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmMIJKj28JcTN1B72p2/pgzDCoguhs/rbIXgN/ybNNh0NVOrZV2KllrmT5VOYlMrABpvIp7JU/n6hma3/O14n7nvngJ/y3colh8rk7msDwVAO7ZuVD+GCzfaYPLLkUS+wqH7M7FOHIn/pyJo1Rkxm98lO3dyox5RuLG2Uqm7JfVIomm0t7QKJoM5rf8JNvPXdwsxN89eWlT2Bf7BF//G3FKiF7ZHfvIyyqte/3orRRG/M80QqLrDP1RIeOa53ZTgILXcyQOb2yZOqNH3iN2uSKRsusNO17To5FOb2J9Hd5wIMuDv3zw4MWTrKAWuTYon90QSeGRKv1d5AQNRt0x5dSwIDAQAB"
  },
  {
    "file": "uidai_offline_publickey_2026.cer",
    "cn": "DS Unique Identification Authority of India 06",
    "spki": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAh1+zYnvbcEm0Yz73s5u42odpUJMr9wv5bVw7sOE5nFNbrB+U++5I0f8cL2HoHnJOkwvLZzrD0jG/vxAKi6vii/gjEzUEgrkdIHxMP3D6GJs0MSQHiEXvIGOwPIH3BLtBOc3m28NVNT6Q9iq0gUwuxnlhV38UdNhCllqNYhWmAMPJkImgaKrRZvY2pWNs6gd+PlAF/9SO69x3+1meA8kPk2ZvQanZlx9tfaExeOe9or3NQiKy2+UbtXrpcoAfYbbWi1OUzXi5bJdhbGp239c1fX6UKyUM5IUMY+m3I7wu2WQ7lmeO2n/vwzQz/PKHXPWYu3bydWMLdCi07vOQBqzCKwIDAQAB"
  },
  {
    "file": "uidai_offline_publickey_26022021.cer",
    "cn": "DS UNIQUE IDENTIFICATION AUTHORITY OF INDIA 05",
    "spki": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAonIsDl8t5bpwftk/A27CsfC5VZMjkPrMDwvL8gyAoVwIi0iGhmty6yWrC/VaL+Brae29XMg7dMdwnbIUHmwHxovN+FnT2vfz/O0kHQcgVdwVSIR0tFwsmC+pVKpSqm//skgYYcZQhdhLZBWOn0PZ81ymm0jOkwBSIQKkyuCTv/1HSwjTLR0EBvaH9+Vb0iaiOEv1ikHDhMOXTxx8URWBnJJt463z7LuZBMSG8fXVMDl3vqY1hDZzKbXBaK/clRIXMff0jUOvfPMfabHju+eUnceosQwL3eurq96+oHahz4FmrfBqikHe3xQ7/4NdvSvVuwth0kcsI0ptRBG8m1NglQIDAQAB"
  },
  {
    "file": "uidai_offline_publickey_29032019.cer",
    "cn": "DS UNIQUE IDENTIFICATION AUTHORITY OF INDIA 04",
    "spki": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAm3ajjc3OQhTkP92CnmYEjXAwVG0KE5AHu6e5hlx1t2zp6ys9pOVlzVTLdRFWj3yLRbSePe75e2UTet0JUCraF7/NrXsARPyjDoVcTTlyj+JEcOYI7VUwg9e35Xp47ADNso6HzHhG1FJ9DMylWMP7ewob/Z0Lnbp1M4ZYGTBE/bZwrfORmZjl8ZKzExd2uzSDGu9qcX0B6bCLvxlwKSobfCtTgWIoZP06+HcKuJ570fi6Z8W7epbL/OPf92eKUyy39W00KZceuHFGonwhLCF/4t7aMySrpVf65wla8dO2NvXylWRyV7j6rR6DnUSFQZSOgZuJyPxMLS3fEzIEOd82WQIDAQAB"
  },
  {
    "file": "uidai_prod_cdup.cer",
    "cn": "DS UNIQUE IDENTIFICATION AUTHORITY OF INDIA 4",
    "spki": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv0HjbFpvu/kR+gTI2+svGNmW4eZHhTVBG/N+byaq3GH0SDM+jO5RW4BbXNzaSKc0I5mIyN1vQf2KmNV/3Xai6MokiiZrBRfM8a497zCMteHTAzSP1L0DmohUuBQh/s1hfqRIIWpfEu7noW2G8toK0ZOQR1E0FtinWNtqEeuxlNEKgfxkN4/vRzgvGFw+PPcoG5uMdcd7/DjDE1i20zmT+55DgIBrneCwrW7nIM0Md3BPOTV8iBwzjdVcdDHhMtSpi9UKUHw80sDRZp7ygB4Z0QmhSxCMCg9g7KPHYY+PVRC2sFreZBC6rtmIL+HMUPciRCCqMZLx3f6xRSD97lZr/wIDAQAB"
  }
]
