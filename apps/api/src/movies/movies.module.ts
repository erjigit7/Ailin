import { Module } from '@nestjs/common';
import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toDbFormat, mapMovieOut } from '../common/format';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';

/** Готовит данные фильма для записи: конвертирует формат и отсекает лишние поля. */
function movieWriteData(data: any) {
  const { id, createdAt, sessions, format, ...rest } = data;
  const out: any = { ...rest };
  const f = toDbFormat(format);
  if (f) out.format = f;
  return out;
}

@Controller('movies')
class MoviesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const movies = await this.prisma.movie.findMany({
      where: { active: true },
      orderBy: { title: 'asc' },
    });
    return movies.map(mapMovieOut);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return mapMovieOut(await this.prisma.movie.findUnique({ where: { id } }));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  async create(@Body() data: any) {
    return mapMovieOut(await this.prisma.movie.create({ data: movieWriteData(data) }));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return mapMovieOut(await this.prisma.movie.update({ where: { id }, data: movieWriteData(data) }));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    // мягкое удаление
    return this.prisma.movie.update({ where: { id }, data: { active: false } });
  }
}

@Module({ controllers: [MoviesController] })
export class MoviesModule {}
