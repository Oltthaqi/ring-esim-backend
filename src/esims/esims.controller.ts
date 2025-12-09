import {
  Controller,
  Get,
  Query,
  // Post,
  // Body,
  // Patch,
  // Param,
  // Delete,
} from '@nestjs/common';
import { EsimsService } from './esims.service';
// import { CreateEsimDto } from './dto/create-esim.dto';
// import { UpdateEsimDto } from './dto/update-esim.dto';

@Controller('esims')
export class EsimsController {
  constructor(private readonly esimsService: EsimsService) {}

  @Get('sync')
  async syncNow(@Query('accountId') accountId: number) {
    return this.esimsService.syncFreeEsims(accountId);
  }

  // @Post()
  // create(@Body() createEsimDto: CreateEsimDto) {
  //   return this.esimsService.create(createEsimDto);
  // }

  // @Get()
  // findAll() {
  //   return this.esimsService.findAll();
  // }

  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.esimsService.findOne(+id);
  // }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateEsimDto: UpdateEsimDto) {
  //   return this.esimsService.update(+id, updateEsimDto);
  // }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.esimsService.remove(+id);
  // }
}
