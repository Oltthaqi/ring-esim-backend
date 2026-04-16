import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import { ResellerOrder } from './entities/reseller-order.entity';

@Injectable()
export class PdfService {
  async generateEsimPdf(order: ResellerOrder): Promise<Buffer> {
    const qrImageBuffer = order.qrUrl
      ? await QRCode.toBuffer(order.qrUrl, {
          width: 180,
          margin: 1,
          errorCorrectionLevel: 'M',
        })
      : null;

    const resellerName = order.reseller?.name ?? 'Reseller';

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 60 });
      const chunks: Buffer[] = [];
      const pageWidth = doc.page.width;
      const left = 60;
      const contentWidth = pageWidth - left * 2;

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── Logo ──
      const logoPath =
        process.env.PDF_LOGO_PATH ||
        path.resolve(process.cwd(), 'assets', 'logo.png');
      if (fs.existsSync(logoPath)) {
        const logoSize = 80;
        const logoX = (pageWidth - logoSize) / 2;
        const logoY = doc.y;
        doc.image(logoPath, logoX, logoY, {
          width: logoSize,
          height: logoSize,
        });
        doc.y = logoY + logoSize + 10;
      } else {
        doc
          .fontSize(28)
          .font('Helvetica-Bold')
          .fillColor('#E91E63')
          .text('Ring eSIM', { align: 'center' });
      }
      doc.moveDown(0.3);

      // ── Thank you + subtitle ──
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('black')
        .text('Faleminderit për besimin!', { align: 'center' });
      doc
        .fontSize(10)
        .font('Helvetica')
        .text('Interneti flakë në kreeejt Europën me Ring eSIM.', {
          align: 'center',
        });
      doc.moveDown(1);

      // ── Activation QR Code ──
      if (qrImageBuffer) {
        const qrSize = 150;
        const qrX = (pageWidth - qrSize) / 2;
        doc.image(qrImageBuffer, qrX, doc.y, {
          width: qrSize,
          height: qrSize,
        });
        doc.y += qrSize + 10;
      }
      doc.moveDown(0.5);

      // ── Package + Agency (centered bold) ──
      doc.fontSize(12).font('Helvetica-Bold').fillColor('black');
      doc.text(`PAKO: ${order.upstreamTemplateName}`, left, doc.y, {
        width: contentWidth,
        align: 'center',
      });
      doc.text(`AGJENCIONI: ${resellerName.toUpperCase()}`, left, doc.y, {
        width: contentWidth,
        align: 'center',
      });
      doc.moveDown(0.3);

      // ── eSIM details (centered) ──
      doc.fontSize(10);
      this.centeredBoldValue(doc, 'Activation Code: ', order.activationCode ?? '-', left, contentWidth);
      this.centeredBoldValue(doc, 'SMDP Address: ', order.smdpServer ?? '-', left, contentWidth);
      this.centeredBoldValue(doc, 'ICCID: ', order.iccid ?? '-', left, contentWidth);

      doc.moveDown(0.8);

      // ── Separator ──
      this.drawLine(doc);
      doc.moveDown(0.5);

      // ── iOS Instructions ──
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('Për të aktivizuar shërbimin tuaj në iPhone:', left, doc.y, {
          width: contentWidth,
          align: 'center',
        });
      doc.moveDown(0.2);
      doc.fontSize(9).font('Helvetica');
      for (const step of [
        '1. Duhet të jeni të lidhur me Wi-Fi.',
        '2. Hapni aplikacionin e "Settings" në pajisjen tuaj.',
        '3. Zgjidhni "Cellular" ose "Mobile Data" dhe pastaj "Add ESIM".',
        '4. Skanoni QR Code ose shfrytëzo Opsionin "Open Photos" dhe',
        '    vendosni QR Code që ju kemi bashkangjitur.',
      ]) {
        doc.text(step, left, doc.y, { width: contentWidth, align: 'center' });
      }

      doc.moveDown(0.6);

      // ── Separator ──
      this.drawLine(doc);
      doc.moveDown(0.5);

      // ── Android Instructions ──
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('Për të aktivizuar shërbimin tuaj në Android:', left, doc.y, {
          width: contentWidth,
          align: 'center',
        });
      doc.moveDown(0.2);
      doc.fontSize(9).font('Helvetica');
      for (const step of [
        '1. Duhet të jeni të lidhur me Wi-Fi.',
        '2. Hapni aplikacionin e "Settings" në pajisjen tuaj.',
        '3. Zgjidhni "Connections" dhe pastaj "SIM Manager" dhe "ADD ESIM".',
        '4. Skanoni QR Code ose shfrytëzo Opsionin "Open Photos" dhe',
        '    vendosni QR Code që ju kemi bashkangjitur.',
      ]) {
        doc.text(step, left, doc.y, { width: contentWidth, align: 'center' });
      }

      doc.moveDown(1.2);

      // ── Data Roaming Warning ──
      doc.font('Helvetica-Bold').fontSize(10).fillColor('black');
      doc.text(
        'VËMENDJE: DATA ROAMING duhet të jetë e aktivizuar "ON" në të gjitha versionet e telefonavë në mënyrë që esim të funksionoj.',
        left,
        doc.y,
        { width: contentWidth, align: 'center' },
      );

      doc.end();
    });
  }

  /** Renders "Label: value" centered — label bold, value normal, single line. */
  private centeredBoldValue(
    doc: PDFKit.PDFDocument,
    label: string,
    value: string,
    left: number,
    contentWidth: number,
  ): void {
    // Measure widths to compute the starting x for true centering
    const boldW = doc.font('Helvetica-Bold').widthOfString(label);
    const normW = doc.font('Helvetica').widthOfString(value);
    const totalW = boldW + normW;
    const x = left + (contentWidth - totalW) / 2;

    const y = doc.y;
    doc.font('Helvetica-Bold').text(label, x, y, { continued: true });
    doc.font('Helvetica').text(value);
  }

  /** Draws a thin horizontal separator line. */
  private drawLine(doc: PDFKit.PDFDocument): void {
    const margin = 90;
    doc
      .strokeColor('#cccccc')
      .lineWidth(0.5)
      .moveTo(margin, doc.y)
      .lineTo(doc.page.width - margin, doc.y)
      .stroke();
  }

  private formatDataVolume(order: ResellerOrder): string {
    const resp = order.upstreamResponse;
    const dataBytes = (resp as Record<string, number> | null)?.databyte ?? 0;
    if (dataBytes <= 0) return 'See plan details';
    const gb = dataBytes / 1_073_741_824;
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(gb * 1024).toFixed(0)} MB`;
  }
}
