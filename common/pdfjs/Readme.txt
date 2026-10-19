PDF.js 3.11.174(pdfjs-dist の legacy build。Mozilla。ライセンス：Apache-2.0、LICENSE.txt)
文書の棚で、PDFをページの中に絵として描くために使う(Androidのアプリの中のブラウザはPDFを表示できないため)。
外部のサイトから読み込まず、このフォルダから読み込む(ページの通信先の制限を守るため)。
入れ替えるときは、pdf.min.js と pdf.worker.min.js を同じ版でそろえ、docs/index.html の「?v=」の版も合わせる。
