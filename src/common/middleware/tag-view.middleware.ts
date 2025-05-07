// src/common/middleware/tag-view.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';// Adjust the path as needed
import { InsightsService } from 'src/insights/insights.service';

@Injectable()
// src/common/middleware/tag-view.middleware.ts
export class TagViewMiddleware implements NestMiddleware {
    constructor(private insightsService: InsightsService) {}
  
    async use(req: Request, res: Response, next: NextFunction) {
      // Only track GET requests to /tag/:tuid
      if (req.method === 'GET' && req.path.match(/^\/tag\/[^\/]+$/)) {
        const tuid = req.path.split('/').pop();
        if (tuid) {
          this.insightsService.recordTagView(tuid, req).catch(error => {
            console.error('Error recording tag view:', error);
          });
        }
      }
      next();
    }
  }