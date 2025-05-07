import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly appUrl: string;

  constructor(
    private mailerService: MailerService,
    private configService: ConfigService,
  ) {
    this.appUrl = this.configService.get('APP_URL', 'https://app.bizcotap.com');
  }

  async sendTagCreatedEmail(
    email: string,
    data: { firstName: string; lastName: string; tagId: string },
  ): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Your Bizcotap Tag is Ready!',
        template: './tag-created',
        context: {
          name: `${data.firstName} ${data.lastName}`,
          tagId: data.tagId,
          appUrl: this.appUrl,
        },
      });
      this.logger.log(`Tag created email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send tag created email to ${email}: ${error.message}`,
      );
      throw error;
    }
  }

  async sendTagOrderNotificationEmail(
    email: string,
    data: {
      firstName: string;
      lastName: string;
      orderId: number;
      requestorName: string;
      requestorEmail: string;
    },
  ): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'New Tag Order Request',
        template: './tag-order-notification',
        context: {
          adminName: `${data.firstName} ${data.lastName}`,
          orderId: data.orderId,
          requestorName: data.requestorName,
          requestorEmail: data.requestorEmail,
          appUrl: this.appUrl,
        },
      });
      this.logger.log(`Tag order notification email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send tag order notification email to ${email}: ${error.message}`,
      );
      throw error;
    }
  }

  async sendTagApprovedEmail(
    email: string,
    data: {
      firstName: string;
      lastName: string;
      tagId: string;
      setPasswordUrl: string;
    },
  ): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Your Bizcotap Tag Request Has Been Approved!',
        template: './tag-approved',
        context: {
          name: `${data.firstName} ${data.lastName}`,
          tagId: data.tagId,
          setPasswordUrl: data.setPasswordUrl,
          appUrl: this.appUrl,
        },
      });
      this.logger.log(`Tag approved email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send tag approved email to ${email}: ${error.message}`,
      );
      throw error;
    }
  }

  async sendTagRejectedEmail(
    email: string,
    data: { firstName: string; lastName: string; orderId: number },
  ): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Your Bizcotap Tag Request Was Not Approved',
        template: './tag-rejected',
        context: {
          name: `${data.firstName} ${data.lastName}`,
          orderId: data.orderId,
          appUrl: this.appUrl,
        },
      });
      this.logger.log(`Tag rejected email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send tag rejected email to ${email}: ${error.message}`,
      );
      throw error;
    }
  }

  async sendPasswordResetEmail(
    email: string,
    data: { firstName: string; lastName: string; resetUrl: string },
  ): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Reset Your Bizcotap Password',
        template: './password-reset',
        context: {
          name: `${data.firstName} ${data.lastName}`,
          resetUrl: data.resetUrl,
          appUrl: this.appUrl,
        },
      });
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${email}: ${error.message}`,
      );
      throw error;
    }
  }
}
