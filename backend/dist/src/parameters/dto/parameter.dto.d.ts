export declare class UpdateCompanyParametersDto {
    companyName?: string;
    companyAddress?: string;
    companyLogo?: string;
    monthlyHoursAllowance?: string;
    hoursBankClosingDate?: string;
}
export declare class PublicCompanyParametersResponse {
    companyName: string;
    companyAddress: string;
    companyLogo: string;
}
export declare class CompanyParametersResponse extends PublicCompanyParametersResponse {
    monthlyHoursAllowance: string;
    hoursBankClosingDate: string;
}
