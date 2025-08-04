from pdf2docx import Converter
import PySimpleGUI as sg


def pdf2word(file_path):
    file_name = file_path.split('.')[0]
    doc_file = f'{file_name}.docx'
    p2w = Converter(file_path)
    p2w.convert(doc_file, start=0, end=None)
    p2w.close()
    return doc_file

pdf2word("a.pdf")